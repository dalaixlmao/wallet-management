"""
Unit tests for the transaction transformer module.
"""

import pytest
from datetime import datetime
import pandas as pd
import pyspark.sql.functions as F
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, IntegerType, StringType, TimestampType

from data_pipeline.transform.transaction_transformer import TransactionTransformer


@pytest.fixture
def spark():
    """Create a SparkSession for testing."""
    return SparkSession.builder \
        .appName("TestTransactionTransformer") \
        .master("local[1]") \
        .getOrCreate()


@pytest.fixture
def transformer():
    """Create a TransactionTransformer instance."""
    return TransactionTransformer()


@pytest.fixture
def sample_transactions(spark):
    """Create sample transaction data."""
    schema = StructType([
        StructField("id", IntegerType(), False),
        StructField("status", StringType(), True),
        StructField("token", StringType(), False),
        StructField("provider", StringType(), False),
        StructField("amount", IntegerType(), True),
        StructField("startTime", TimestampType(), True),
        StructField("userId", IntegerType(), False)
    ])
    
    data = [
        (1, "success", "token1", "provider1", 100, datetime(2023, 1, 1, 10, 0), 1),
        (2, "failure", "token2", "provider2", 200, datetime(2023, 1, 1, 11, 0), 2),
        (3, "processing", "token3", "provider1", None, datetime(2023, 1, 2, 10, 0), 1),
        (4, "success", "token4", "provider2", 400, None, 3),
        (5, "success", "token5", "provider3", 500, datetime(2023, 1, 2, 12, 0), 2)
    ]
    
    return spark.createDataFrame(data, schema)


@pytest.fixture
def sample_p2p_transfers(spark):
    """Create sample P2P transfer data."""
    schema = StructType([
        StructField("id", IntegerType(), False),
        StructField("amount", IntegerType(), True),
        StructField("timestamp", TimestampType(), True),
        StructField("fromUserId", IntegerType(), False),
        StructField("toUserId", IntegerType(), False)
    ])
    
    data = [
        (1, 100, datetime(2023, 1, 1, 10, 0), 1, 2),
        (2, 200, datetime(2023, 1, 1, 11, 0), 2, 3),
        (3, None, datetime(2023, 1, 2, 10, 0), 3, 1),
        (4, 400, None, 1, 3),
        (5, 500, datetime(2023, 1, 2, 12, 0), 2, 1),
        (6, 600, datetime(2023, 1, 3, 9, 0), 1, 1)  # Self-transfer (should be filtered)
    ]
    
    return spark.createDataFrame(data, schema)


@pytest.fixture
def sample_users(spark):
    """Create sample user data."""
    schema = StructType([
        StructField("id", IntegerType(), False),
        StructField("email", StringType(), True),
        StructField("name", StringType(), True),
        StructField("number", StringType(), False)
    ])
    
    data = [
        (1, "user1@example.com", "User 1", "123456"),
        (2, "user2@example.com", "User 2", "234567"),
        (3, "user3@example.com", "User 3", "345678")
    ]
    
    return spark.createDataFrame(data, schema)


def test_clean_transactions(transformer, sample_transactions):
    """Test clean_transactions method."""
    result = transformer.clean_transactions(sample_transactions)
    
    # Check that result has the expected shape
    assert result.count() == sample_transactions.count()
    
    # Check that status is uppercase
    statuses = [row.status for row in result.select("status").collect()]
    assert all(s.isupper() for s in statuses)
    
    # Check that null amounts are replaced with 0
    amounts = [row.amount for row in result.select("amount").collect()]
    assert None not in amounts
    
    # Check that timestamps are properly handled
    times = [row.startTime for row in result.select("startTime").collect()]
    assert all(isinstance(t, datetime) or t is None for t in times)


def test_clean_p2p_transfers(transformer, sample_p2p_transfers):
    """Test clean_p2p_transfers method."""
    result = transformer.clean_p2p_transfers(sample_p2p_transfers)
    
    # Check that result has the expected shape (minus the self-transfer)
    assert result.count() == sample_p2p_transfers.count() - 1
    
    # Check that null amounts are replaced with 0
    amounts = [row.amount for row in result.select("amount").collect()]
    assert None not in amounts
    
    # Check that timestamps are properly handled
    times = [row.timestamp for row in result.select("timestamp").collect()]
    assert all(isinstance(t, datetime) or t is None for t in times)
    
    # Check that self-transfers are filtered out
    user_pairs = [(row.fromUserId, row.toUserId) for row in result.collect()]
    assert all(pair[0] != pair[1] for pair in user_pairs)


def test_aggregate_daily_transactions(transformer, sample_transactions):
    """Test aggregate_daily_transactions method."""
    result = transformer.aggregate_daily_transactions(sample_transactions)
    
    # There should be one row for each unique (date, userId, status) combination
    assert result.count() >= 1
    
    # Check that the aggregation contains the expected columns
    assert "date" in result.columns
    assert "userId" in result.columns
    assert "status" in result.columns
    assert "totalAmount" in result.columns
    assert "count" in result.columns
    assert "avgAmount" in result.columns


def test_aggregate_daily_p2p_transfers(transformer, sample_p2p_transfers):
    """Test aggregate_daily_p2p_transfers method."""
    result = transformer.aggregate_daily_p2p_transfers(sample_p2p_transfers)
    
    # Check that result has rows
    assert result.count() >= 1
    
    # Check that the aggregation contains the expected columns
    assert "date" in result.columns
    assert "userId" in result.columns
    assert "totalSentAmount" in result.columns
    assert "sentCount" in result.columns
    assert "totalReceivedAmount" in result.columns
    assert "receivedCount" in result.columns
    assert "netAmount" in result.columns


def test_join_with_user_data(transformer, sample_transactions, sample_users):
    """Test join_with_user_data method."""
    result = transformer.join_with_user_data(sample_transactions, sample_users)
    
    # Check that the number of rows matches the transactions
    assert result.count() == sample_transactions.count()
    
    # Check that user information is included
    assert "email" in result.columns
    assert "name" in result.columns
    assert "number" in result.columns
    
    # Check that the join was performed correctly
    # Get a user ID from transactions and verify the corresponding user data
    user_id = sample_transactions.select("userId").collect()[0][0]
    user_row = sample_users.filter(F.col("id") == user_id).collect()[0]
    
    joined_row = result.filter(F.col("userId") == user_id).collect()[0]
    assert joined_row.email == user_row.email
    assert joined_row.name == user_row.name
    assert joined_row.number == user_row.number


def test_calculate_user_metrics(transformer, sample_transactions, sample_p2p_transfers):
    """Test calculate_user_metrics method."""
    # First clean the data to match how it would be used in practice
    clean_transactions = transformer.clean_transactions(sample_transactions)
    clean_p2p = transformer.clean_p2p_transfers(sample_p2p_transfers)
    
    result = transformer.calculate_user_metrics(clean_transactions, clean_p2p)
    
    # Check that result has rows for each user
    user_ids = set(row.userId for row in clean_transactions.select("userId").collect()) | \
              set(row.fromUserId for row in clean_p2p.select("fromUserId").collect()) | \
              set(row.toUserId for row in clean_p2p.select("toUserId").collect())
    
    assert result.count() >= len(user_ids)
    
    # Check that the metrics contains the expected columns
    assert "userId" in result.columns
    assert "totalTransactionAmount" in result.columns
    assert "totalTransactionCount" in result.columns
    assert "netP2PAmount" in result.columns
    assert "lastActivityTime" in result.columns