"""
Utility module to create and configure Spark sessions.
Supports local development, AWS EMR, GCP Dataproc, and Azure Synapse.
"""

import os
from typing import Dict, Optional

from pyspark.sql import SparkSession
from pyspark.conf import SparkConf

from data_pipeline.config.config import load_config, get_spark_config


def create_spark_session(app_name: Optional[str] = None, 
                         configs: Optional[Dict[str, str]] = None) -> SparkSession:
    """
    Create a configured Spark session.
    
    Args:
        app_name: Optional name for the Spark application
        configs: Optional additional Spark configurations
        
    Returns:
        Configured SparkSession
    """
    # Load configuration
    config = load_config()
    spark_configs = get_spark_config()
    
    # Override app_name if provided
    if app_name:
        spark_configs["spark.app.name"] = app_name
    
    # Add any additional configurations
    if configs:
        spark_configs.update(configs)
    
    # Create SparkConf
    conf = SparkConf()
    for key, value in spark_configs.items():
        conf.set(key, value)
    
    # Create the SparkSession builder
    builder = SparkSession.builder.config(conf=conf)
    
    # Add cloud-specific configurations
    env = config.get("environment", "development")
    
    if env == "development":
        # Local development setup
        builder = builder.master(config["spark"].get("master", "local[*]"))
        
    elif "aws" in config:
        # AWS EMR/Glue setup
        # AWS credentials will be picked up from the environment or instance profile
        jar_paths = [
            "org.apache.hadoop:hadoop-aws:3.3.1",
            "com.amazonaws:aws-java-sdk-bundle:1.12.180"
        ]
        builder = builder.config("spark.jars.packages", ",".join(jar_paths))
        
    elif "gcp" in config:
        # GCP Dataproc setup
        # GCP credentials will be picked up from the environment or service account
        jar_paths = [
            "com.google.cloud.bigdataoss:gcs-connector:hadoop3-2.2.6"
        ]
        builder = builder.config("spark.jars.packages", ",".join(jar_paths))
        
    elif "azure" in config:
        # Azure Synapse setup
        # Azure credentials will be picked up from the environment
        jar_paths = [
            "org.apache.hadoop:hadoop-azure:3.3.1",
            "com.microsoft.azure:azure-storage:8.6.6"
        ]
        builder = builder.config("spark.jars.packages", ",".join(jar_paths))
    
    # Create and return the SparkSession
    spark = builder.getOrCreate()
    
    # Set log level
    log_level = config["spark"].get("log_level", "INFO")
    spark.sparkContext.setLogLevel(log_level)
    
    return spark


def get_spark_session() -> SparkSession:
    """
    Get an existing SparkSession or create a new one.
    
    Returns:
        SparkSession
    """
    try:
        # Try to get the active SparkSession
        spark = SparkSession.getActiveSession()
        if spark:
            return spark
    except Exception:
        pass
    
    # Create a new SparkSession if none exists
    return create_spark_session()