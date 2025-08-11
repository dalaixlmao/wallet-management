"""
Configuration module for the data pipeline.
Contains configuration settings for different environments: development, staging, production.
"""

import os
from typing import Dict, Any
import json

# Default configurations
DEFAULT_CONFIG = {
    "environment": "development",
    "spark": {
        "app_name": "DataPipeline",
        "master": "local[*]",
        "log_level": "WARN",
        "checkpoint_location": "/tmp/checkpoints",
        "executor_memory": "4g",
        "driver_memory": "2g",
        "shuffle_partitions": 200,
        "default_parallelism": 100
    },
    "aws": {
        "region": "us-east-1",
        "s3": {
            "bucket": "data-pipeline-bucket",
            "input_prefix": "raw/",
            "output_prefix": "processed/",
            "archive_prefix": "archive/"
        },
        "glue": {
            "database": "data_pipeline_db",
            "catalog_id": ""
        },
        "emr": {
            "cluster_name": "DataPipelineCluster",
            "release_label": "emr-6.10.0",
            "instance_count": 3,
            "instance_type": "m5.xlarge"
        }
    },
    "gcp": {
        "project": "data-pipeline-project",
        "region": "us-central1",
        "gcs": {
            "bucket": "data-pipeline-bucket",
            "input_prefix": "raw/",
            "output_prefix": "processed/",
            "archive_prefix": "archive/"
        },
        "bigquery": {
            "dataset": "data_pipeline_dataset",
            "location": "US"
        },
        "dataflow": {
            "temp_location": "gs://data-pipeline-bucket/temp/",
            "staging_location": "gs://data-pipeline-bucket/staging/",
            "machine_type": "n1-standard-2"
        }
    },
    "azure": {
        "subscription_id": "",
        "resource_group": "data-pipeline-rg",
        "region": "eastus",
        "storage": {
            "account_name": "datapipelinestorage",
            "container": "data-pipeline",
            "input_prefix": "raw/",
            "output_prefix": "processed/",
            "archive_prefix": "archive/"
        },
        "synapse": {
            "workspace_name": "data-pipeline-synapse",
            "pool_name": "SparkPool",
            "database": "data_pipeline_db"
        }
    },
    "database": {
        "url": "postgresql://localhost:5432/data_pipeline",
        "user": "${DB_USER}",
        "password": "${DB_PASSWORD}",
        "max_connections": 10,
        "timeout": 30
    },
    "logging": {
        "level": "INFO",
        "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        "file": "/tmp/data-pipeline.log"
    },
    "monitoring": {
        "enable_metrics": True,
        "metrics_endpoint": "",
        "alert_threshold": 0.9
    }
}


def load_config(env: str = None) -> Dict[str, Any]:
    """
    Load configuration based on the environment.
    
    Args:
        env: Environment name (development, staging, production)
        
    Returns:
        Dict containing configuration settings
    """
    env = env or os.environ.get("PIPELINE_ENV", "development")
    
    # Start with default config
    config = DEFAULT_CONFIG.copy()
    
    # Try to load environment-specific configuration file
    config_path = os.path.join(os.path.dirname(__file__), f"{env}_config.json")
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            env_config = json.load(f)
            deep_update(config, env_config)
    
    # Override with environment variables
    env_override(config)
    
    return config


def deep_update(d: Dict[str, Any], u: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively update a dictionary."""
    for k, v in u.items():
        if isinstance(v, dict) and k in d and isinstance(d[k], dict):
            deep_update(d[k], v)
        else:
            d[k] = v
    return d


def env_override(config: Dict[str, Any], prefix: str = "PIPELINE_") -> None:
    """
    Override configuration with environment variables.
    Environment variables should follow the pattern PIPELINE_X_Y_Z for config["x"]["y"]["z"]
    """
    for key in os.environ:
        if key.startswith(prefix):
            # Remove prefix and split by underscore
            path = key[len(prefix):].lower().split('_')
            
            # Navigate to the correct position in config
            current = config
            for p in path[:-1]:
                if p not in current:
                    current[p] = {}
                current = current[p]
            
            # Set the value, with type conversion if necessary
            value = os.environ[key]
            if value.lower() in ('true', 'yes', '1'):
                value = True
            elif value.lower() in ('false', 'no', '0'):
                value = False
            elif value.isdigit():
                value = int(value)
            elif value.replace('.', '', 1).isdigit() and value.count('.') == 1:
                value = float(value)
                
            current[path[-1]] = value


def get_spark_config() -> Dict[str, str]:
    """
    Get Spark configuration as a dictionary of key-value pairs.
    
    Returns:
        Dict containing Spark configuration
    """
    config = load_config()
    spark_conf = {}
    
    # Convert the nested spark config to flat key-value pairs
    spark_section = config.get("spark", {})
    for key, value in spark_section.items():
        spark_conf[f"spark.{key}"] = str(value)
    
    # Add cloud-specific configurations if needed
    env = config.get("environment", "development")
    
    if env != "development":
        # AWS EMR/Glue specific configs
        if "aws" in config:
            spark_conf["spark.hadoop.fs.s3a.impl"] = "org.apache.hadoop.fs.s3a.S3AFileSystem"
            spark_conf["spark.hadoop.fs.s3a.aws.credentials.provider"] = "com.amazonaws.auth.DefaultAWSCredentialsProviderChain"
            
        # GCP Dataproc specific configs
        elif "gcp" in config and config.get("gcp", {}).get("project"):
            spark_conf["spark.hadoop.fs.gs.impl"] = "com.google.cloud.hadoop.fs.gcs.GoogleHadoopFileSystem"
            spark_conf["spark.hadoop.fs.gs.project.id"] = config["gcp"]["project"]
            
        # Azure Synapse specific configs
        elif "azure" in config and config.get("azure", {}).get("storage", {}).get("account_name"):
            spark_conf["spark.hadoop.fs.azure.account.key.{}.dfs.core.windows.net".format(
                config["azure"]["storage"]["account_name"])] = "${AZURE_STORAGE_KEY}"
    
    return spark_conf