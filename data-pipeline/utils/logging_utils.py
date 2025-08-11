"""
Utility module for setting up logging with appropriate handlers and formatters.
"""

import logging
import os
import sys
from typing import Dict, Any, Optional

from data_pipeline.config.config import load_config


def setup_logger(name: str, 
                 config: Optional[Dict[str, Any]] = None,
                 log_to_file: bool = True) -> logging.Logger:
    """
    Configure and return a logger with the specified name.
    
    Args:
        name: Name of the logger
        config: Optional configuration dictionary
        log_to_file: Whether to log to a file in addition to console
        
    Returns:
        Configured logger instance
    """
    # Load config if not provided
    if config is None:
        config = load_config()
        
    # Get logging configuration
    log_config = config.get("logging", {})
    log_level_name = log_config.get("level", "INFO")
    log_level = getattr(logging, log_level_name.upper())
    log_format = log_config.get("format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    log_file = log_config.get("file", "/tmp/data-pipeline.log")
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(log_level)
    logger.handlers = []  # Remove any existing handlers
    
    # Create formatters and handlers
    formatter = logging.Formatter(log_format)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (if requested)
    if log_to_file:
        # Create directory for log file if it doesn't exist
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
            
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get an existing logger or create a new one with default settings.
    
    Args:
        name: Name of the logger
        
    Returns:
        Logger instance
    """
    logger = logging.getLogger(name)
    
    # If the logger doesn't have handlers, set it up
    if not logger.handlers:
        logger = setup_logger(name)
        
    return logger