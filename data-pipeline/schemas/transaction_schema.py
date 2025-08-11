"""
Schema definitions for transaction data models.
Includes schema validation and evolution utilities.
"""

from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType,
    TimestampType, BooleanType
)

# OnRampTransaction schema
onramp_transaction_schema = StructType([
    StructField("id", IntegerType(), False),
    StructField("status", StringType(), False),
    StructField("token", StringType(), False),
    StructField("provider", StringType(), False),
    StructField("amount", IntegerType(), False),
    StructField("startTime", TimestampType(), False),
    StructField("userId", IntegerType(), False)
])

# P2P Transfer schema
p2p_transfer_schema = StructType([
    StructField("id", IntegerType(), False),
    StructField("amount", IntegerType(), False),
    StructField("timestamp", TimestampType(), False),
    StructField("fromUserId", IntegerType(), False),
    StructField("toUserId", IntegerType(), False)
])

# User schema
user_schema = StructType([
    StructField("id", IntegerType(), False),
    StructField("email", StringType(), True),
    StructField("name", StringType(), True),
    StructField("number", StringType(), False)
])

# Balance schema
balance_schema = StructType([
    StructField("id", IntegerType(), False),
    StructField("userId", IntegerType(), False),
    StructField("amount", IntegerType(), False),
    StructField("locked", IntegerType(), False)
])

# Aggregated transaction schema for analytics
transaction_analytics_schema = StructType([
    StructField("date", TimestampType(), False),
    StructField("userId", IntegerType(), False),
    StructField("transactionType", StringType(), False),
    StructField("totalAmount", IntegerType(), False),
    StructField("count", IntegerType(), False),
    StructField("avgAmount", IntegerType(), False),
    StructField("providerOrRecipient", StringType(), True)
])

# User balance history schema for time series analysis
balance_history_schema = StructType([
    StructField("userId", IntegerType(), False),
    StructField("timestamp", TimestampType(), False),
    StructField("amount", IntegerType(), False),
    StructField("locked", IntegerType(), False),
    StructField("availableBalance", IntegerType(), False)
])

# Schema for anomaly detection
transaction_anomaly_schema = StructType([
    StructField("userId", IntegerType(), False),
    StructField("transactionId", IntegerType(), False),
    StructField("timestamp", TimestampType(), False),
    StructField("amount", IntegerType(), False),
    StructField("isAnomaly", BooleanType(), False),
    StructField("anomalyScore", IntegerType(), False),
    StructField("reason", StringType(), True)
])


def get_schema_by_name(name: str) -> StructType:
    """
    Get a schema definition by name.
    
    Args:
        name: Name of the schema to retrieve
        
    Returns:
        The corresponding StructType schema
        
    Raises:
        ValueError: If schema name is not found
    """
    schemas = {
        "onramp_transaction": onramp_transaction_schema,
        "p2p_transfer": p2p_transfer_schema,
        "user": user_schema,
        "balance": balance_schema,
        "transaction_analytics": transaction_analytics_schema,
        "balance_history": balance_history_schema,
        "transaction_anomaly": transaction_anomaly_schema
    }
    
    if name not in schemas:
        raise ValueError(f"Schema '{name}' not found. Available schemas: {', '.join(schemas.keys())}")
    
    return schemas[name]