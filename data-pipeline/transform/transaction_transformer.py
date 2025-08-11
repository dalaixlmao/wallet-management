"""
Transaction data transformation module.
Handles data cleansing, enrichment, and aggregation for analytical purposes.
"""

from typing import Dict, Optional, List

import pyspark.sql.functions as F
from pyspark.sql import DataFrame, Window
from pyspark.sql.types import IntegerType, TimestampType

from data_pipeline.utils.logging_utils import get_logger


logger = get_logger(__name__)


class TransactionTransformer:
    """
    Transform transaction data for analytical processing.
    """
    
    def __init__(self):
        """Initialize the TransactionTransformer."""
        pass
    
    @staticmethod
    def clean_transactions(df: DataFrame) -> DataFrame:
        """
        Clean transaction data by handling nulls, duplicates, and data type issues.
        
        Args:
            df: Input DataFrame with transaction data
            
        Returns:
            Cleaned DataFrame
        """
        try:
            # Remove any duplicates based on transaction ID
            df = df.dropDuplicates(["id"])
            
            # Convert status to uppercase for consistency
            df = df.withColumn("status", F.upper(F.col("status")))
            
            # Handle any null values in amount (replace with 0)
            df = df.withColumn("amount", F.coalesce(F.col("amount"), F.lit(0)))
            
            # Ensure timestamp is in the correct format
            df = df.withColumn("startTime", F.to_timestamp(F.col("startTime")))
            
            logger.info(f"Cleaned {df.count()} transactions")
            return df
            
        except Exception as e:
            logger.error(f"Error cleaning transaction data: {str(e)}")
            raise
    
    @staticmethod
    def clean_p2p_transfers(df: DataFrame) -> DataFrame:
        """
        Clean P2P transfer data.
        
        Args:
            df: Input DataFrame with P2P transfer data
            
        Returns:
            Cleaned DataFrame
        """
        try:
            # Remove any duplicates based on transfer ID
            df = df.dropDuplicates(["id"])
            
            # Handle any null values in amount
            df = df.withColumn("amount", F.coalesce(F.col("amount"), F.lit(0)))
            
            # Ensure timestamp is in the correct format
            df = df.withColumn("timestamp", F.to_timestamp(F.col("timestamp")))
            
            # Validate that sender and receiver IDs are different
            df = df.filter(F.col("fromUserId") != F.col("toUserId"))
            
            logger.info(f"Cleaned {df.count()} P2P transfers")
            return df
            
        except Exception as e:
            logger.error(f"Error cleaning P2P transfer data: {str(e)}")
            raise
    
    @staticmethod
    def aggregate_daily_transactions(df: DataFrame) -> DataFrame:
        """
        Aggregate transaction data by day, user, and status.
        
        Args:
            df: Input DataFrame with transaction data
            
        Returns:
            Aggregated DataFrame
        """
        try:
            # Extract date from timestamp
            df_with_date = df.withColumn("date", F.to_date(F.col("startTime")))
            
            # Group by date, user, and status
            aggregated = df_with_date.groupBy("date", "userId", "status") \
                .agg(
                    F.sum("amount").alias("totalAmount"),
                    F.count("id").alias("count"),
                    F.avg("amount").cast(IntegerType()).alias("avgAmount")
                ) \
                .orderBy("date", "userId")
            
            logger.info(f"Created daily transaction aggregations")
            return aggregated
            
        except Exception as e:
            logger.error(f"Error aggregating transaction data: {str(e)}")
            raise
    
    @staticmethod
    def aggregate_daily_p2p_transfers(df: DataFrame) -> DataFrame:
        """
        Aggregate P2P transfer data by day and user.
        
        Args:
            df: Input DataFrame with P2P transfer data
            
        Returns:
            Aggregated DataFrame with sent and received transfers
        """
        try:
            # Extract date from timestamp
            df_with_date = df.withColumn("date", F.to_date(F.col("timestamp")))
            
            # Aggregate sent transfers by user
            sent_transfers = df_with_date.groupBy("date", "fromUserId") \
                .agg(
                    F.sum("amount").alias("totalSentAmount"),
                    F.count("id").alias("sentCount"),
                    F.avg("amount").cast(IntegerType()).alias("avgSentAmount")
                ) \
                .withColumnRenamed("fromUserId", "userId")
            
            # Aggregate received transfers by user
            received_transfers = df_with_date.groupBy("date", "toUserId") \
                .agg(
                    F.sum("amount").alias("totalReceivedAmount"),
                    F.count("id").alias("receivedCount"),
                    F.avg("amount").cast(IntegerType()).alias("avgReceivedAmount")
                ) \
                .withColumnRenamed("toUserId", "userId")
            
            # Join the two aggregations
            result = sent_transfers.join(
                received_transfers,
                on=["date", "userId"],
                how="outer"
            ).fillna(0)
            
            # Calculate net transfer amount
            result = result.withColumn(
                "netAmount",
                F.col("totalReceivedAmount") - F.col("totalSentAmount")
            )
            
            logger.info(f"Created daily P2P transfer aggregations")
            return result
            
        except Exception as e:
            logger.error(f"Error aggregating P2P transfer data: {str(e)}")
            raise
    
    @staticmethod
    def join_with_user_data(transactions_df: DataFrame, users_df: DataFrame) -> DataFrame:
        """
        Join transaction data with user information.
        
        Args:
            transactions_df: Transaction DataFrame
            users_df: User DataFrame
            
        Returns:
            Joined DataFrame
        """
        try:
            # Join transaction data with user data
            joined = transactions_df.join(
                users_df.select("id", "email", "name", "number"),
                transactions_df.userId == users_df.id,
                "left"
            ).drop(users_df.id)
            
            logger.info(f"Joined transaction data with user information")
            return joined
            
        except Exception as e:
            logger.error(f"Error joining transaction data with user data: {str(e)}")
            raise
    
    @staticmethod
    def calculate_user_metrics(onramp_df: DataFrame, p2p_df: DataFrame) -> DataFrame:
        """
        Calculate comprehensive user metrics combining onramp and p2p data.
        
        Args:
            onramp_df: OnRamp transaction DataFrame
            p2p_df: P2P transfer DataFrame
            
        Returns:
            User metrics DataFrame
        """
        try:
            # Get successful onramp transactions
            successful_onramp = onramp_df.filter(F.col("status") == "SUCCESS")
            
            # Calculate metrics from onramp transactions
            onramp_metrics = successful_onramp.groupBy("userId") \
                .agg(
                    F.sum("amount").alias("totalOnRampAmount"),
                    F.count("id").alias("onRampCount"),
                    F.avg("amount").cast(IntegerType()).alias("avgOnRampAmount"),
                    F.max("startTime").alias("lastOnRampTime")
                )
            
            # Calculate metrics from p2p transfers (sent)
            sent_metrics = p2p_df.groupBy("fromUserId") \
                .agg(
                    F.sum("amount").alias("totalSentAmount"),
                    F.count("id").alias("sentCount"),
                    F.avg("amount").cast(IntegerType()).alias("avgSentAmount"),
                    F.max("timestamp").alias("lastSentTime")
                ) \
                .withColumnRenamed("fromUserId", "userId")
            
            # Calculate metrics from p2p transfers (received)
            received_metrics = p2p_df.groupBy("toUserId") \
                .agg(
                    F.sum("amount").alias("totalReceivedAmount"),
                    F.count("id").alias("receivedCount"),
                    F.avg("amount").cast(IntegerType()).alias("avgReceivedAmount"),
                    F.max("timestamp").alias("lastReceivedTime")
                ) \
                .withColumnRenamed("toUserId", "userId")
            
            # Join all metrics
            user_metrics = onramp_metrics \
                .join(sent_metrics, on="userId", how="outer") \
                .join(received_metrics, on="userId", how="outer") \
                .fillna(0)
            
            # Calculate derived metrics
            user_metrics = user_metrics \
                .withColumn("totalTransactionAmount", 
                    F.col("totalOnRampAmount") + F.col("totalSentAmount") + F.col("totalReceivedAmount")
                ) \
                .withColumn("totalTransactionCount", 
                    F.col("onRampCount") + F.col("sentCount") + F.col("receivedCount")
                ) \
                .withColumn("netP2PAmount", 
                    F.col("totalReceivedAmount") - F.col("totalSentAmount")
                ) \
                .withColumn("lastActivityTime", 
                    F.greatest(
                        F.coalesce(F.col("lastOnRampTime"), F.lit("1970-01-01").cast(TimestampType())),
                        F.coalesce(F.col("lastSentTime"), F.lit("1970-01-01").cast(TimestampType())),
                        F.coalesce(F.col("lastReceivedTime"), F.lit("1970-01-01").cast(TimestampType()))
                    )
                )
            
            logger.info(f"Calculated user metrics for {user_metrics.count()} users")
            return user_metrics
            
        except Exception as e:
            logger.error(f"Error calculating user metrics: {str(e)}")
            raise
    
    @staticmethod
    def detect_anomalies(df: DataFrame, threshold_multiplier: float = 3.0) -> DataFrame:
        """
        Detect anomalous transactions using statistical methods.
        
        Args:
            df: Transaction DataFrame
            threshold_multiplier: Multiplier for standard deviation threshold
            
        Returns:
            DataFrame with anomaly flags and scores
        """
        try:
            # Calculate user statistics
            user_stats = df.groupBy("userId") \
                .agg(
                    F.avg("amount").alias("avgAmount"),
                    F.stddev("amount").alias("stddevAmount"),
                    F.count("id").alias("transactionCount")
                )
            
            # Join statistics back to transactions
            df_with_stats = df.join(user_stats, on="userId", how="left")
            
            # Mark transactions as anomalies if they exceed threshold
            # Only apply to users with sufficient transaction history
            result = df_with_stats \
                .withColumn("hasEnoughHistory", F.col("transactionCount") >= 5) \
                .withColumn("threshold", 
                    F.when(
                        F.col("hasEnoughHistory"),
                        F.col("avgAmount") + (threshold_multiplier * F.col("stddevAmount"))
                    ).otherwise(F.lit(float("inf")))
                ) \
                .withColumn("isAnomaly", 
                    F.when(
                        F.col("hasEnoughHistory") & (F.col("amount") > F.col("threshold")),
                        F.lit(True)
                    ).otherwise(F.lit(False))
                ) \
                .withColumn("anomalyScore",
                    F.when(
                        F.col("isAnomaly"),
                        F.round((F.col("amount") - F.col("avgAmount")) / F.col("stddevAmount"), 2)
                    ).otherwise(F.lit(0))
                ) \
                .withColumn("reason",
                    F.when(
                        F.col("isAnomaly"),
                        F.concat(
                            F.lit("Amount exceeds user average by "),
                            F.round(F.col("anomalyScore"), 1),
                            F.lit(" standard deviations")
                        )
                    ).otherwise(F.lit(None))
                )
            
            # Select relevant columns
            result = result.select(
                "id", "userId", "amount", "startTime", "status", "provider",
                "isAnomaly", "anomalyScore", "reason"
            )
            
            anomaly_count = result.filter(F.col("isAnomaly")).count()
            logger.info(f"Detected {anomaly_count} anomalous transactions")
            return result
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {str(e)}")
            raise
    
    @staticmethod
    def calculate_balance_history(onramp_df: DataFrame, p2p_df: DataFrame) -> DataFrame:
        """
        Calculate historical balance changes for each user.
        
        Args:
            onramp_df: OnRamp transaction DataFrame
            p2p_df: P2P transfer DataFrame
            
        Returns:
            Balance history DataFrame
        """
        try:
            # Create change records for successful onramp transactions
            onramp_changes = onramp_df \
                .filter(F.col("status") == "SUCCESS") \
                .select(
                    F.col("userId"),
                    F.col("startTime").alias("timestamp"),
                    F.col("amount"),
                    F.lit("onramp").alias("type"),
                    F.lit(0).alias("fromUserId"),
                    F.lit(0).alias("toUserId")
                )
            
            # Create change records for sent P2P transfers
            sent_changes = p2p_df \
                .select(
                    F.col("fromUserId").alias("userId"),
                    F.col("timestamp"),
                    F.col("amount").alias("amount"),
                    F.lit("sent").alias("type"),
                    F.col("fromUserId"),
                    F.col("toUserId")
                )
            
            # Create change records for received P2P transfers
            received_changes = p2p_df \
                .select(
                    F.col("toUserId").alias("userId"),
                    F.col("timestamp"),
                    F.col("amount"),
                    F.lit("received").alias("type"),
                    F.col("fromUserId"),
                    F.col("toUserId")
                )
            
            # Union all changes
            all_changes = onramp_changes \
                .union(sent_changes) \
                .union(received_changes)
            
            # Calculate balance change amount
            balance_changes = all_changes \
                .withColumn("balanceChange",
                    F.when(F.col("type") == "sent", -F.col("amount"))
                     .when(F.col("type").isin(["received", "onramp"]), F.col("amount"))
                     .otherwise(0)
                )
            
            # Sort by user and timestamp
            sorted_changes = balance_changes.orderBy("userId", "timestamp")
            
            # Define window for running sum
            window_spec = Window \
                .partitionBy("userId") \
                .orderBy("timestamp") \
                .rowsBetween(Window.unboundedPreceding, Window.currentRow)
            
            # Calculate running balance
            balance_history = sorted_changes \
                .withColumn("runningBalance", F.sum("balanceChange").over(window_spec)) \
                .select(
                    "userId",
                    "timestamp",
                    "type",
                    "amount",
                    "balanceChange",
                    "runningBalance"
                )
            
            logger.info(f"Created balance history for {balance_history.select('userId').distinct().count()} users")
            return balance_history
            
        except Exception as e:
            logger.error(f"Error calculating balance history: {str(e)}")
            raise