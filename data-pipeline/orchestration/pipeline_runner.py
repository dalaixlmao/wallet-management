"""
Main pipeline runner module for orchestrating end-to-end data processing.
Handles execution flow, error handling, and retries.
"""

import os
import sys
import time
import datetime
import argparse
from typing import Dict, Any, Optional, List, Union

from pyspark.sql import SparkSession

from data_pipeline.config.config import load_config
from data_pipeline.utils.spark_session import create_spark_session
from data_pipeline.utils.logging_utils import setup_logger
from data_pipeline.extract.database_extractor import DatabaseExtractor
from data_pipeline.transform.transaction_transformer import TransactionTransformer
from data_pipeline.load.data_writer import DataWriter


class PipelineRunner:
    """
    Orchestrate end-to-end data pipeline execution.
    Handles extraction, transformation, and loading of data.
    """
    
    def __init__(self, env: str = None, config_overrides: Optional[Dict[str, Any]] = None):
        """
        Initialize the pipeline runner.
        
        Args:
            env: Environment to run in (development, staging, production)
            config_overrides: Optional configuration overrides
        """
        # Load configuration
        self.config = load_config(env)
        
        # Apply any configuration overrides
        if config_overrides:
            for key, value in config_overrides.items():
                self.config[key] = value
        
        # Set up logging
        self.logger = setup_logger("pipeline_runner", self.config)
        
        # Initialize SparkSession
        self.spark = create_spark_session()
        
        # Initialize pipeline components
        self.extractor = DatabaseExtractor(self.spark, self.config)
        self.transformer = TransactionTransformer()
        self.writer = DataWriter(self.spark, self.config)
        
        # Set default values
        self.env = self.config.get("environment", "development")
        
        # Pipeline status
        self.pipeline_start_time = None
        self.pipeline_end_time = None
        self.execution_status = "NOT_STARTED"
        
    def extract_data(self, last_run_timestamp: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract data from source systems.
        
        Args:
            last_run_timestamp: Optional timestamp for incremental extraction
            
        Returns:
            Dictionary containing extracted DataFrames
        """
        self.logger.info("Starting data extraction phase")
        
        try:
            # Extract transaction data
            transactions_df = self.extractor.extract_transactions(last_run_timestamp)
            self.logger.info(f"Extracted {transactions_df.count()} transactions")
            
            # Extract P2P transfer data
            p2p_df = self.extractor.extract_p2p_transfers(last_run_timestamp)
            self.logger.info(f"Extracted {p2p_df.count()} P2P transfers")
            
            # Extract user data
            users_df = self.extractor.extract_users()
            self.logger.info(f"Extracted {users_df.count()} users")
            
            # Extract balance data
            balances_df = self.extractor.extract_balances()
            self.logger.info(f"Extracted {balances_df.count()} balance records")
            
            # Extract joined transaction data for convenience
            joined_transactions_df = self.extractor.extract_joined_transactions(last_run_timestamp)
            joined_p2p_df = self.extractor.extract_joined_p2p_transfers(last_run_timestamp)
            
            self.logger.info("Data extraction completed successfully")
            
            return {
                "transactions": transactions_df,
                "p2p_transfers": p2p_df,
                "users": users_df,
                "balances": balances_df,
                "joined_transactions": joined_transactions_df,
                "joined_p2p_transfers": joined_p2p_df
            }
            
        except Exception as e:
            self.logger.error(f"Error during data extraction: {str(e)}")
            raise
    
    def transform_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform extracted data.
        
        Args:
            extracted_data: Dictionary containing extracted DataFrames
            
        Returns:
            Dictionary containing transformed DataFrames
        """
        self.logger.info("Starting data transformation phase")
        
        try:
            # Clean transaction data
            clean_transactions = self.transformer.clean_transactions(extracted_data["transactions"])
            self.logger.info("Cleaned transaction data")
            
            # Clean P2P transfer data
            clean_p2p = self.transformer.clean_p2p_transfers(extracted_data["p2p_transfers"])
            self.logger.info("Cleaned P2P transfer data")
            
            # Aggregate transactions by day
            daily_transactions = self.transformer.aggregate_daily_transactions(clean_transactions)
            self.logger.info("Created daily transaction aggregations")
            
            # Aggregate P2P transfers by day
            daily_p2p = self.transformer.aggregate_daily_p2p_transfers(clean_p2p)
            self.logger.info("Created daily P2P transfer aggregations")
            
            # Join transaction data with user information
            enriched_transactions = self.transformer.join_with_user_data(
                clean_transactions, extracted_data["users"]
            )
            self.logger.info("Enriched transactions with user data")
            
            # Calculate user metrics
            user_metrics = self.transformer.calculate_user_metrics(
                clean_transactions, clean_p2p
            )
            self.logger.info("Calculated user metrics")
            
            # Detect anomalous transactions
            anomalies = self.transformer.detect_anomalies(clean_transactions)
            self.logger.info("Detected transaction anomalies")
            
            # Calculate balance history
            balance_history = self.transformer.calculate_balance_history(
                clean_transactions, clean_p2p
            )
            self.logger.info("Created balance history")
            
            self.logger.info("Data transformation completed successfully")
            
            return {
                "clean_transactions": clean_transactions,
                "clean_p2p_transfers": clean_p2p,
                "daily_transactions": daily_transactions,
                "daily_p2p_transfers": daily_p2p,
                "enriched_transactions": enriched_transactions,
                "user_metrics": user_metrics,
                "anomalies": anomalies,
                "balance_history": balance_history
            }
            
        except Exception as e:
            self.logger.error(f"Error during data transformation: {str(e)}")
            raise
    
    def load_data(self, transformed_data: Dict[str, Any], destination: str = "parquet") -> Dict[str, str]:
        """
        Load transformed data to destination.
        
        Args:
            transformed_data: Dictionary containing transformed DataFrames
            destination: Destination format (parquet, delta, jdbc, bigquery, synapse)
            
        Returns:
            Dictionary mapping data types to output locations
        """
        self.logger.info(f"Starting data loading phase to {destination}")
        
        output_paths = {}
        
        try:
            # Write clean transactions
            output_paths["transactions"] = self.writer.write_data_by_type(
                transformed_data["clean_transactions"],
                "transactions",
                destination,
                partition_cols=["status"] if destination in ["parquet", "delta"] else None
            )
            self.logger.info(f"Wrote clean transactions to {output_paths['transactions']}")
            
            # Write clean P2P transfers
            output_paths["p2p_transfers"] = self.writer.write_data_by_type(
                transformed_data["clean_p2p_transfers"],
                "p2p_transfers",
                destination
            )
            self.logger.info(f"Wrote clean P2P transfers to {output_paths['p2p_transfers']}")
            
            # Write daily transaction aggregations
            output_paths["daily_transactions"] = self.writer.write_data_by_type(
                transformed_data["daily_transactions"],
                "daily_transactions",
                destination,
                partition_cols=["date"] if destination in ["parquet", "delta"] else None
            )
            self.logger.info(f"Wrote daily transactions to {output_paths['daily_transactions']}")
            
            # Write daily P2P transfer aggregations
            output_paths["daily_p2p_transfers"] = self.writer.write_data_by_type(
                transformed_data["daily_p2p_transfers"],
                "daily_p2p_transfers",
                destination,
                partition_cols=["date"] if destination in ["parquet", "delta"] else None
            )
            self.logger.info(f"Wrote daily P2P transfers to {output_paths['daily_p2p_transfers']}")
            
            # Write user metrics
            output_paths["user_metrics"] = self.writer.write_data_by_type(
                transformed_data["user_metrics"],
                "user_metrics",
                destination
            )
            self.logger.info(f"Wrote user metrics to {output_paths['user_metrics']}")
            
            # Write anomalies
            output_paths["anomalies"] = self.writer.write_data_by_type(
                transformed_data["anomalies"],
                "anomalies",
                destination
            )
            self.logger.info(f"Wrote anomalies to {output_paths['anomalies']}")
            
            # Write balance history
            output_paths["balance_history"] = self.writer.write_data_by_type(
                transformed_data["balance_history"],
                "balance_history",
                destination
            )
            self.logger.info(f"Wrote balance history to {output_paths['balance_history']}")
            
            self.logger.info("Data loading completed successfully")
            
            return output_paths
            
        except Exception as e:
            self.logger.error(f"Error during data loading: {str(e)}")
            raise
    
    def run_pipeline(self, 
                    last_run_timestamp: Optional[str] = None, 
                    destination: str = "parquet",
                    skip_extract: bool = False,
                    skip_transform: bool = False,
                    skip_load: bool = False,
                    extracted_data_path: Optional[str] = None,
                    transformed_data_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Run the complete ETL/ELT pipeline.
        
        Args:
            last_run_timestamp: Optional timestamp for incremental processing
            destination: Destination format for output data
            skip_extract: Whether to skip the extraction phase
            skip_transform: Whether to skip the transformation phase
            skip_load: Whether to skip the loading phase
            extracted_data_path: Path to load extracted data from (if skipping extract)
            transformed_data_path: Path to load transformed data from (if skipping transform)
            
        Returns:
            Dictionary containing pipeline execution results
        """
        self.pipeline_start_time = datetime.datetime.now()
        self.execution_status = "RUNNING"
        
        self.logger.info(f"Starting pipeline run in {self.env} environment")
        self.logger.info(f"Pipeline start time: {self.pipeline_start_time}")
        
        extracted_data = {}
        transformed_data = {}
        output_paths = {}
        
        try:
            # Extract phase
            if not skip_extract:
                self.logger.info("Running extraction phase")
                extracted_data = self.extract_data(last_run_timestamp)
            else:
                self.logger.info("Skipping extraction phase")
                if extracted_data_path:
                    self.logger.info(f"Loading extracted data from {extracted_data_path}")
                    # Logic to load extracted data from path
                    pass
            
            # Transform phase
            if not skip_transform:
                self.logger.info("Running transformation phase")
                transformed_data = self.transform_data(extracted_data)
            else:
                self.logger.info("Skipping transformation phase")
                if transformed_data_path:
                    self.logger.info(f"Loading transformed data from {transformed_data_path}")
                    # Logic to load transformed data from path
                    pass
            
            # Load phase
            if not skip_load:
                self.logger.info(f"Running loading phase with destination {destination}")
                output_paths = self.load_data(transformed_data, destination)
            else:
                self.logger.info("Skipping loading phase")
            
            self.execution_status = "SUCCESS"
            self.logger.info("Pipeline execution completed successfully")
            
        except Exception as e:
            self.execution_status = "FAILED"
            self.logger.error(f"Pipeline execution failed: {str(e)}")
            raise
        finally:
            self.pipeline_end_time = datetime.datetime.now()
            duration = (self.pipeline_end_time - self.pipeline_start_time).total_seconds()
            self.logger.info(f"Pipeline end time: {self.pipeline_end_time}")
            self.logger.info(f"Pipeline duration: {duration:.2f} seconds")
            
            # Log execution metrics
            metrics = {
                "pipeline_start_time": self.pipeline_start_time.isoformat(),
                "pipeline_end_time": self.pipeline_end_time.isoformat(),
                "duration_seconds": duration,
                "status": self.execution_status,
                "environment": self.env
            }
            
            # Add record counts to metrics if available
            if extracted_data:
                for key, df in extracted_data.items():
                    metrics[f"extracted_{key}_count"] = df.count()
            
            if transformed_data:
                for key, df in transformed_data.items():
                    metrics[f"transformed_{key}_count"] = df.count()
            
            self.logger.info(f"Pipeline metrics: {metrics}")
            
            return {
                "status": self.execution_status,
                "metrics": metrics,
                "output_paths": output_paths
            }
    
    def stop(self):
        """Stop the pipeline and clean up resources."""
        if self.spark:
            self.spark.stop()
        self.logger.info("Pipeline resources cleaned up")


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Run the data pipeline")
    
    parser.add_argument(
        "--env",
        choices=["development", "staging", "production"],
        default="development",
        help="Environment to run the pipeline in"
    )
    
    parser.add_argument(
        "--last-run-timestamp",
        help="Timestamp for incremental processing (ISO format)"
    )
    
    parser.add_argument(
        "--destination",
        choices=["parquet", "delta", "jdbc", "bigquery", "synapse"],
        default="parquet",
        help="Destination format for output data"
    )
    
    parser.add_argument(
        "--skip-extract",
        action="store_true",
        help="Skip the extraction phase"
    )
    
    parser.add_argument(
        "--skip-transform",
        action="store_true",
        help="Skip the transformation phase"
    )
    
    parser.add_argument(
        "--skip-load",
        action="store_true",
        help="Skip the loading phase"
    )
    
    parser.add_argument(
        "--extracted-data-path",
        help="Path to load extracted data from (if skipping extract)"
    )
    
    parser.add_argument(
        "--transformed-data-path",
        help="Path to load transformed data from (if skipping transform)"
    )
    
    return parser.parse_args()


def main():
    """Main entry point for the pipeline."""
    args = parse_args()
    
    try:
        # Initialize and run pipeline
        pipeline = PipelineRunner(env=args.env)
        
        result = pipeline.run_pipeline(
            last_run_timestamp=args.last_run_timestamp,
            destination=args.destination,
            skip_extract=args.skip_extract,
            skip_transform=args.skip_transform,
            skip_load=args.skip_load,
            extracted_data_path=args.extracted_data_path,
            transformed_data_path=args.transformed_data_path
        )
        
        # Clean up
        pipeline.stop()
        
        # Exit with appropriate code
        sys.exit(0 if result["status"] == "SUCCESS" else 1)
        
    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()