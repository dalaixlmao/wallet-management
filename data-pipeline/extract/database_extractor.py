"""
Database extractor module for extracting transaction data from PostgreSQL database.
Handles connection pooling, incremental extraction, and error handling.
"""

import os
import datetime
from typing import Dict, Any, List, Optional, Union

from pyspark.sql import SparkSession, DataFrame
import pyspark.sql.functions as F
from pyspark.sql.types import StructType

from data_pipeline.config.config import load_config
from data_pipeline.utils.logging_utils import get_logger
from data_pipeline.schemas.transaction_schema import get_schema_by_name


logger = get_logger(__name__)


class DatabaseExtractor:
    """
    Extract data from PostgreSQL database using JDBC.
    Supports incremental extraction based on timestamp or ID.
    """
    
    def __init__(self, spark: SparkSession, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the DatabaseExtractor.
        
        Args:
            spark: SparkSession
            config: Optional configuration dictionary
        """
        self.spark = spark
        self.config = config or load_config()
        self.db_config = self.config.get("database", {})
        
        # JDBC options
        self.jdbc_url = self.db_config.get("url", "").replace("postgresql://", "jdbc:postgresql://")
        self.jdbc_options = {
            "user": self.db_config.get("user", ""),
            "password": self.db_config.get("password", ""),
            "driver": "org.postgresql.Driver",
        }
        
        # Handle environment variables in config
        for key, value in self.jdbc_options.items():
            if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                env_var = value[2:-1]
                self.jdbc_options[key] = os.environ.get(env_var, "")
    
    def extract_table(self, 
                      table: str, 
                      schema: Optional[StructType] = None,
                      partition_column: Optional[str] = None,
                      num_partitions: int = 10,
                      predicates: Optional[List[str]] = None,
                      query: Optional[str] = None) -> DataFrame:
        """
        Extract data from a database table.
        
        Args:
            table: Table name
            schema: Optional schema for the DataFrame
            partition_column: Column to use for partitioning
            num_partitions: Number of partitions
            predicates: Optional list of predicates for data filtering
            query: Optional custom SQL query instead of table name
            
        Returns:
            DataFrame with the extracted data
        """
        try:
            options = self.jdbc_options.copy()
            
            if query:
                options["query"] = query
                table = f"({query}) AS tmp"
            
            # Set up partitioning if specified
            if partition_column:
                logger.info(f"Extracting table {table} with partitioning on {partition_column}")
                
                # Get min and max values for the partition column
                query_min_max = f"(SELECT MIN({partition_column}) as min_val, MAX({partition_column}) as max_val FROM {table}) as min_max"
                min_max_df = self.spark.read.jdbc(
                    url=self.jdbc_url,
                    table=query_min_max,
                    properties=options
                )
                min_max_row = min_max_df.collect()[0]
                min_val = min_max_row["min_val"]
                max_val = min_max_row["max_val"]
                
                if min_val is not None and max_val is not None:
                    # Calculate partition boundaries
                    stride = max(1, (max_val - min_val) // num_partitions)
                    predicates = []
                    
                    # Generate predicates for each partition
                    for i in range(num_partitions):
                        lower_bound = min_val + i * stride
                        upper_bound = min_val + (i + 1) * stride
                        
                        if i == 0:
                            pred = f"{partition_column} < {upper_bound}"
                        elif i == num_partitions - 1:
                            pred = f"{partition_column} >= {lower_bound}"
                        else:
                            pred = f"{partition_column} >= {lower_bound} AND {partition_column} < {upper_bound}"
                            
                        predicates.append(pred)
            
            # Read data with or without predicates
            if predicates:
                logger.info(f"Using {len(predicates)} predicates for extraction")
                df = self.spark.read.jdbc(
                    url=self.jdbc_url,
                    table=table,
                    properties=options,
                    predicates=predicates
                )
            else:
                df = self.spark.read.jdbc(
                    url=self.jdbc_url,
                    table=table,
                    properties=options
                )
            
            # Apply schema if provided
            if schema:
                df = self.spark.createDataFrame(df.rdd, schema)
            
            logger.info(f"Successfully extracted {df.count()} rows from {table}")
            return df
            
        except Exception as e:
            logger.error(f"Error extracting data from table {table}: {str(e)}")
            raise
    
    def extract_incremental(self,
                           table: str,
                           timestamp_col: str,
                           last_run_timestamp: Optional[Union[str, datetime.datetime]] = None,
                           schema: Optional[StructType] = None) -> DataFrame:
        """
        Extract data incrementally based on a timestamp column.
        
        Args:
            table: Table name
            timestamp_col: Column name containing the timestamp
            last_run_timestamp: Timestamp of the last successful run
            schema: Optional schema for the DataFrame
            
        Returns:
            DataFrame with incrementally extracted data
        """
        try:
            # Convert timestamp to string if it's a datetime object
            if isinstance(last_run_timestamp, datetime.datetime):
                last_run_timestamp = last_run_timestamp.isoformat()
            
            # Build query for incremental extraction
            if last_run_timestamp:
                query = f"SELECT * FROM {table} WHERE {timestamp_col} >= '{last_run_timestamp}'"
                logger.info(f"Extracting incremental data from {table} with timestamp >= {last_run_timestamp}")
            else:
                query = f"SELECT * FROM {table}"
                logger.info(f"No last run timestamp provided, extracting all data from {table}")
            
            # Extract data
            df = self.extract_table(table=table, schema=schema, query=query)
            
            # Get the max timestamp for the next run
            if df.count() > 0:
                max_timestamp = df.agg(F.max(timestamp_col)).collect()[0][0]
                logger.info(f"Max timestamp in extracted data: {max_timestamp}")
            
            return df
            
        except Exception as e:
            logger.error(f"Error in incremental extraction for table {table}: {str(e)}")
            raise
    
    def extract_transactions(self, last_run_timestamp: Optional[str] = None) -> DataFrame:
        """
        Extract OnRampTransaction data.
        
        Args:
            last_run_timestamp: Optional timestamp for incremental extraction
            
        Returns:
            DataFrame containing transaction data
        """
        schema = get_schema_by_name("onramp_transaction")
        return self.extract_incremental(
            table="OnRampTransaction",
            timestamp_col="startTime",
            last_run_timestamp=last_run_timestamp,
            schema=schema
        )
    
    def extract_p2p_transfers(self, last_run_timestamp: Optional[str] = None) -> DataFrame:
        """
        Extract P2P transfer data.
        
        Args:
            last_run_timestamp: Optional timestamp for incremental extraction
            
        Returns:
            DataFrame containing p2p transfer data
        """
        schema = get_schema_by_name("p2p_transfer")
        return self.extract_incremental(
            table="p2pTransfer",
            timestamp_col="timestamp",
            last_run_timestamp=last_run_timestamp,
            schema=schema
        )
    
    def extract_balances(self) -> DataFrame:
        """
        Extract balance data.
        
        Returns:
            DataFrame containing balance data
        """
        schema = get_schema_by_name("balance")
        return self.extract_table(table="Balance", schema=schema)
    
    def extract_users(self) -> DataFrame:
        """
        Extract user data.
        
        Returns:
            DataFrame containing user data
        """
        schema = get_schema_by_name("user")
        return self.extract_table(table="User", schema=schema)
    
    def extract_joined_transactions(self, last_run_timestamp: Optional[str] = None) -> DataFrame:
        """
        Extract transactions joined with user information.
        
        Args:
            last_run_timestamp: Optional timestamp for incremental extraction
            
        Returns:
            DataFrame with joined transaction and user data
        """
        query = f"""
        SELECT t.*, u.email, u.name, u.number
        FROM OnRampTransaction t
        JOIN "User" u ON t.userId = u.id
        {f"WHERE t.startTime >= '{last_run_timestamp}'" if last_run_timestamp else ""}
        """
        
        return self.extract_table(table="", query=query)
    
    def extract_joined_p2p_transfers(self, last_run_timestamp: Optional[str] = None) -> DataFrame:
        """
        Extract p2p transfers joined with sender and receiver information.
        
        Args:
            last_run_timestamp: Optional timestamp for incremental extraction
            
        Returns:
            DataFrame with joined p2p transfer and user data
        """
        query = f"""
        SELECT 
            p.*,
            sender.email as sender_email,
            sender.name as sender_name,
            sender.number as sender_number,
            receiver.email as receiver_email,
            receiver.name as receiver_name,
            receiver.number as receiver_number
        FROM p2pTransfer p
        JOIN "User" sender ON p.fromUserId = sender.id
        JOIN "User" receiver ON p.toUserId = receiver.id
        {f"WHERE p.timestamp >= '{last_run_timestamp}'" if last_run_timestamp else ""}
        """
        
        return self.extract_table(table="", query=query)