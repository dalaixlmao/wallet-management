"""
Unit tests for the database extractor module.
"""

import pytest
from unittest.mock import MagicMock, patch
import datetime

import pyspark.sql.functions as F
from pyspark.sql import SparkSession

from data_pipeline.extract.database_extractor import DatabaseExtractor


@pytest.fixture
def spark():
    """Create a SparkSession for testing."""
    return SparkSession.builder \
        .appName("TestDatabaseExtractor") \
        .master("local[1]") \
        .getOrCreate()


@pytest.fixture
def mock_config():
    """Create a mock configuration."""
    return {
        "database": {
            "url": "postgresql://localhost:5432/test_db",
            "user": "test_user",
            "password": "test_password"
        }
    }


@pytest.fixture
def extractor(spark, mock_config):
    """Create a DatabaseExtractor instance with mocked dependencies."""
    return DatabaseExtractor(spark, mock_config)


def test_init(extractor, mock_config):
    """Test initialization of DatabaseExtractor."""
    assert extractor.spark is not None
    assert extractor.config == mock_config
    assert extractor.jdbc_url == "jdbc:postgresql://localhost:5432/test_db"
    assert extractor.jdbc_options["user"] == "test_user"
    assert extractor.jdbc_options["password"] == "test_password"


@patch("data_pipeline.extract.database_extractor.DatabaseExtractor.extract_table")
def test_extract_transactions(mock_extract_table, extractor):
    """Test extract_transactions method."""
    # Mock the extract_table method
    mock_extract_table.return_value = MagicMock()
    
    # Call the method
    result = extractor.extract_transactions("2023-01-01T00:00:00")
    
    # Check that extract_table was called correctly
    mock_extract_table.assert_called_once()
    args, kwargs = mock_extract_table.call_args
    assert kwargs["table"] == "OnRampTransaction"
    assert kwargs["timestamp_col"] == "startTime"
    assert kwargs["last_run_timestamp"] == "2023-01-01T00:00:00"
    assert kwargs["schema"] is not None


@patch("data_pipeline.extract.database_extractor.DatabaseExtractor.extract_table")
def test_extract_p2p_transfers(mock_extract_table, extractor):
    """Test extract_p2p_transfers method."""
    # Mock the extract_table method
    mock_extract_table.return_value = MagicMock()
    
    # Call the method
    result = extractor.extract_p2p_transfers("2023-01-01T00:00:00")
    
    # Check that extract_table was called correctly
    mock_extract_table.assert_called_once()
    args, kwargs = mock_extract_table.call_args
    assert kwargs["table"] == "p2pTransfer"
    assert kwargs["timestamp_col"] == "timestamp"
    assert kwargs["last_run_timestamp"] == "2023-01-01T00:00:00"
    assert kwargs["schema"] is not None


@patch("data_pipeline.extract.database_extractor.DatabaseExtractor.extract_table")
def test_extract_balances(mock_extract_table, extractor):
    """Test extract_balances method."""
    # Mock the extract_table method
    mock_extract_table.return_value = MagicMock()
    
    # Call the method
    result = extractor.extract_balances()
    
    # Check that extract_table was called correctly
    mock_extract_table.assert_called_once()
    args, kwargs = mock_extract_table.call_args
    assert kwargs["table"] == "Balance"
    assert kwargs["schema"] is not None


@patch("data_pipeline.extract.database_extractor.DatabaseExtractor.extract_table")
def test_extract_users(mock_extract_table, extractor):
    """Test extract_users method."""
    # Mock the extract_table method
    mock_extract_table.return_value = MagicMock()
    
    # Call the method
    result = extractor.extract_users()
    
    # Check that extract_table was called correctly
    mock_extract_table.assert_called_once()
    args, kwargs = mock_extract_table.call_args
    assert kwargs["table"] == "User"
    assert kwargs["schema"] is not None


@patch("data_pipeline.extract.database_extractor.DatabaseExtractor.extract_table")
def test_extract_joined_transactions(mock_extract_table, extractor):
    """Test extract_joined_transactions method."""
    # Mock the extract_table method
    mock_extract_table.return_value = MagicMock()
    
    # Call the method
    result = extractor.extract_joined_transactions("2023-01-01T00:00:00")
    
    # Check that extract_table was called correctly
    mock_extract_table.assert_called_once()
    args, kwargs = mock_extract_table.call_args
    assert kwargs["table"] == ""
    assert "query" in kwargs
    assert "JOIN" in kwargs["query"]
    assert "startTime >= '2023-01-01T00:00:00'" in kwargs["query"]