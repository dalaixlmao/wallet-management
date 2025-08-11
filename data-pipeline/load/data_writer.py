"""
Data writer module for loading processed data into various destinations.
Supports writing to S3/GCS/Azure, data warehouses, and databases.
"""

import os
from typing import Dict, Any, Optional, List, Union
import datetime
from urllib.parse import urlparse

from pyspark.sql import DataFrame, SparkSession

from data_pipeline.config.config import load_config
from data_pipeline.utils.logging_utils import get_logger


logger = get_logger(__name__)


class DataWriter:
    """
    Write processed data to various destinations including cloud storage, 
    data warehouses, and databases.
    """
    
    def __init__(self, spark: SparkSession, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the DataWriter.
        
        Args:
            spark: SparkSession
            config: Optional configuration dictionary
        """
        self.spark = spark
        self.config = config or load_config()
        self.env = self.config.get("environment", "development")
    
    def _get_output_path(self, data_type: str, partition_date: Optional[str] = None) -> str:
        """
        Get the output path based on the environment and data type.
        
        Args:
            data_type: Type of data (e.g., 'transactions', 'users')
            partition_date: Optional partition date in YYYY/MM/DD format
            
        Returns:
            Output path for the data
        """
        # Determine base path based on cloud provider
        if "aws" in self.config:
            bucket = self.config["aws"]["s3"]["bucket"]
            prefix = self.config["aws"]["s3"]["output_prefix"]
            base_path = f"s3a://{bucket}/{prefix}"
        elif "gcp" in self.config:
            bucket = self.config["gcp"]["gcs"]["bucket"]
            prefix = self.config["gcp"]["gcs"]["output_prefix"]
            base_path = f"gs://{bucket}/{prefix}"
        elif "azure" in self.config:
            account_name = self.config["azure"]["storage"]["account_name"]
            container = self.config["azure"]["storage"]["container"]
            prefix = self.config["azure"]["storage"]["output_prefix"]
            base_path = f"abfss://{container}@{account_name}.dfs.core.windows.net/{prefix}"
        else:
            # Local development path
            base_path = "/tmp/data-pipeline/output"
        
        # Build the full path
        if partition_date:
            return f"{base_path}{data_type}/{partition_date}"
        return f"{base_path}{data_type}"
    
    def write_parquet(self, 
                      df: DataFrame, 
                      data_type: str,
                      partition_cols: Optional[List[str]] = None,
                      mode: str = "overwrite",
                      partition_date: Optional[str] = None) -> str:
        """
        Write DataFrame to Parquet format.
        
        Args:
            df: DataFrame to write
            data_type: Type of data (e.g., 'transactions', 'users')
            partition_cols: Optional list of columns to partition by
            mode: Write mode (overwrite, append)
            partition_date: Optional specific partition date (YYYY/MM/DD)
            
        Returns:
            Output path where data was written
        """
        try:
            # Get output path
            output_path = self._get_output_path(data_type, partition_date)
            
            # Ensure the output directory exists for local filesystem
            if output_path.startswith("file:") or output_path.startswith("/"):
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Write DataFrame
            writer = df.write.mode(mode).format("parquet")
            
            # Add partitioning if specified
            if partition_cols:
                writer = writer.partitionBy(*partition_cols)
            
            # Execute the write
            writer.save(output_path)
            
            logger.info(f"Successfully wrote {df.count()} rows to {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error writing parquet data for {data_type}: {str(e)}")
            raise
    
    def write_delta(self, 
                   df: DataFrame, 
                   data_type: str,
                   partition_cols: Optional[List[str]] = None,
                   mode: str = "overwrite",
                   merge_keys: Optional[List[str]] = None) -> str:
        """
        Write DataFrame to Delta Lake format.
        
        Args:
            df: DataFrame to write
            data_type: Type of data (e.g., 'transactions', 'users')
            partition_cols: Optional list of columns to partition by
            mode: Write mode (overwrite, append, merge)
            merge_keys: Keys to use for merging when mode is 'merge'
            
        Returns:
            Output path where data was written
        """
        try:
            # Get output path
            output_path = self._get_output_path(data_type)
            
            # Check if Delta is available
            if "delta" not in self.spark.version:
                logger.warning("Delta Lake is not available in this Spark version. Falling back to Parquet.")
                return self.write_parquet(df, data_type, partition_cols, mode)
            
            # Handle merge mode
            if mode == "merge" and merge_keys:
                from delta.tables import DeltaTable
                
                # Check if the Delta table exists
                try:
                    delta_table = DeltaTable.forPath(self.spark, output_path)
                    
                    # Perform a merge operation
                    delta_table.alias("target").merge(
                        df.alias("source"),
                        " AND ".join([f"target.{key} = source.{key}" for key in merge_keys])
                    ) \
                    .whenMatchedUpdateAll() \
                    .whenNotMatchedInsertAll() \
                    .execute()
                    
                    logger.info(f"Successfully merged {df.count()} rows to Delta table at {output_path}")
                    return output_path
                    
                except Exception as merge_error:
                    logger.warning(f"Delta table does not exist or merge failed: {str(merge_error)}")
                    logger.info("Creating new Delta table instead")
                    mode = "overwrite"
            
            # Write DataFrame using standard write for overwrite or append
            writer = df.write.mode(mode).format("delta")
            
            # Add partitioning if specified
            if partition_cols:
                writer = writer.partitionBy(*partition_cols)
            
            # Execute the write
            writer.save(output_path)
            
            logger.info(f"Successfully wrote {df.count()} rows to Delta table at {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error writing Delta data for {data_type}: {str(e)}")
            raise
    
    def write_jdbc(self, 
                  df: DataFrame, 
                  table: str,
                  mode: str = "overwrite",
                  url: Optional[str] = None,
                  properties: Optional[Dict[str, str]] = None) -> None:
        """
        Write DataFrame to a database table using JDBC.
        
        Args:
            df: DataFrame to write
            table: Target table name
            mode: Write mode (overwrite, append)
            url: Optional JDBC URL (defaults to config)
            properties: Optional JDBC properties (defaults to config)
        """
        try:
            # Get database configuration
            db_config = self.config.get("database", {})
            
            # Use provided URL or get from config
            jdbc_url = url or db_config.get("url", "").replace("postgresql://", "jdbc:postgresql://")
            
            # Use provided properties or build from config
            jdbc_properties = properties or {
                "user": db_config.get("user", ""),
                "password": db_config.get("password", ""),
                "driver": "org.postgresql.Driver"
            }
            
            # Handle environment variables in config
            for key, value in jdbc_properties.items():
                if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                    env_var = value[2:-1]
                    jdbc_properties[key] = os.environ.get(env_var, "")
            
            # Write DataFrame
            df.write \
                .format("jdbc") \
                .option("url", jdbc_url) \
                .option("dbtable", table) \
                .mode(mode) \
                .options(**jdbc_properties) \
                .save()
            
            logger.info(f"Successfully wrote {df.count()} rows to JDBC table {table}")
            
        except Exception as e:
            logger.error(f"Error writing to JDBC table {table}: {str(e)}")
            raise
    
    def write_to_bigquery(self, 
                        df: DataFrame, 
                        table: str,
                        mode: str = "overwrite",
                        dataset: Optional[str] = None) -> None:
        """
        Write DataFrame to BigQuery.
        
        Args:
            df: DataFrame to write
            table: Target table name
            mode: Write mode (overwrite, append)
            dataset: Optional dataset name (defaults to config)
        """
        try:
            # Check if GCP configuration exists
            if "gcp" not in self.config:
                raise ValueError("GCP configuration not found in config")
            
            # Get BigQuery configuration
            bq_config = self.config["gcp"].get("bigquery", {})
            
            # Use provided dataset or get from config
            dataset_name = dataset or bq_config.get("dataset", "data_pipeline_dataset")
            project = self.config["gcp"].get("project", "")
            
            # Full table reference
            table_id = f"{project}.{dataset_name}.{table}"
            
            # Write to BigQuery
            df.write \
                .format("bigquery") \
                .option("table", table_id) \
                .option("temporaryGcsBucket", self.config["gcp"]["gcs"]["bucket"]) \
                .mode(mode) \
                .save()
            
            logger.info(f"Successfully wrote {df.count()} rows to BigQuery table {table_id}")
            
        except Exception as e:
            logger.error(f"Error writing to BigQuery table {table}: {str(e)}")
            raise
    
    def write_to_synapse(self, 
                       df: DataFrame, 
                       table: str,
                       mode: str = "overwrite",
                       database: Optional[str] = None) -> None:
        """
        Write DataFrame to Azure Synapse Analytics.
        
        Args:
            df: DataFrame to write
            table: Target table name
            mode: Write mode (overwrite, append)
            database: Optional database name (defaults to config)
        """
        try:
            # Check if Azure configuration exists
            if "azure" not in self.config:
                raise ValueError("Azure configuration not found in config")
            
            # Get Synapse configuration
            synapse_config = self.config["azure"].get("synapse", {})
            
            # Use provided database or get from config
            db_name = database or synapse_config.get("database", "data_pipeline_db")
            
            # Get storage account information for staging
            storage_account = self.config["azure"]["storage"]["account_name"]
            container = self.config["azure"]["storage"]["container"]
            
            # Construct JDBC URL for Synapse
            workspace = synapse_config.get("workspace_name", "")
            pool_name = synapse_config.get("pool_name", "")
            
            jdbc_url = f"jdbc:sqlserver://{workspace}.sql.azuresynapse.net:1433;database={db_name}"
            
            # JDBC properties
            properties = {
                "user": "${SYNAPSE_USER}",
                "password": "${SYNAPSE_PASSWORD}",
                "driver": "com.microsoft.sqlserver.jdbc.SQLServerDriver",
                "hostNameInCertificate": "*.sql.azuresynapse.net",
                "encrypt": "true",
                "trustServerCertificate": "false",
                "loginTimeout": "30"
            }
            
            # Handle environment variables in properties
            for key, value in properties.items():
                if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                    env_var = value[2:-1]
                    properties[key] = os.environ.get(env_var, "")
            
            # Configure temporary storage for bulk loading
            temp_dir = f"abfss://{container}@{storage_account}.dfs.core.windows.net/temp/synapse_bulk_load"
            
            # Write using PolyBase
            df.write \
                .format("jdbc") \
                .option("url", jdbc_url) \
                .option("dbtable", table) \
                .option("tempDir", temp_dir) \
                .option("forwardSparkAzureStorageCredentials", "true") \
                .mode(mode) \
                .options(**properties) \
                .save()
            
            logger.info(f"Successfully wrote {df.count()} rows to Synapse table {table}")
            
        except Exception as e:
            logger.error(f"Error writing to Synapse table {table}: {str(e)}")
            raise
    
    def write_data_by_type(self, 
                         df: DataFrame, 
                         data_type: str,
                         destination: str = "parquet",
                         partition_cols: Optional[List[str]] = None,
                         mode: str = "overwrite") -> str:
        """
        Write data based on data type and destination format.
        
        Args:
            df: DataFrame to write
            data_type: Type of data (e.g., 'transactions', 'users')
            destination: Destination format ('parquet', 'delta', 'jdbc', 'bigquery', 'synapse')
            partition_cols: Optional list of columns to partition by
            mode: Write mode (overwrite, append)
            
        Returns:
            Output path or description of where data was written
        """
        if destination == "parquet":
            # For time-series data, use date-based partitioning
            if data_type in ["transactions", "p2p_transfers", "balance_history"]:
                today = datetime.datetime.now().strftime("%Y/%m/%d")
                return self.write_parquet(df, data_type, partition_cols, mode, today)
            return self.write_parquet(df, data_type, partition_cols, mode)
            
        elif destination == "delta":
            return self.write_delta(df, data_type, partition_cols, mode)
            
        elif destination == "jdbc":
            # Map data types to table names
            table_map = {
                "transactions": "analytics_transactions",
                "p2p_transfers": "analytics_p2p_transfers",
                "users": "analytics_users",
                "user_metrics": "analytics_user_metrics",
                "anomalies": "analytics_anomalies",
                "balance_history": "analytics_balance_history"
            }
            table_name = table_map.get(data_type, f"analytics_{data_type}")
            self.write_jdbc(df, table_name, mode)
            return f"JDBC table: {table_name}"
            
        elif destination == "bigquery":
            if "gcp" not in self.config:
                raise ValueError("GCP configuration required for BigQuery destination")
                
            self.write_to_bigquery(df, data_type, mode)
            return f"BigQuery table: {data_type}"
            
        elif destination == "synapse":
            if "azure" not in self.config:
                raise ValueError("Azure configuration required for Synapse destination")
                
            self.write_to_synapse(df, data_type, mode)
            return f"Synapse table: {data_type}"
            
        else:
            raise ValueError(f"Unsupported destination format: {destination}")