# Data Pipeline User Guide

This guide provides instructions for setting up, configuring, and running the data pipeline for transaction data processing.

## Prerequisites

- Python 3.8+
- Java 11+ (for Apache Spark)
- Docker and Docker Compose (for containerized deployment)

## Installation

### Local Development Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Navigate to the data pipeline directory:
   ```
   cd data-pipeline
   ```

3. Create a virtual environment and activate it:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

### Using Docker

1. Build and run the Docker container:
   ```
   docker-compose build
   docker-compose up data-pipeline
   ```

## Configuration

### Environment Variables

The pipeline uses environment variables for configuration. You can set these in a `.env` file or export them directly:

```
# Database connection
PIPELINE_DATABASE_URL=postgresql://user:password@localhost:5432/database
PIPELINE_DATABASE_USER=user
PIPELINE_DATABASE_PASSWORD=password

# AWS configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
PIPELINE_AWS_S3_BUCKET=your-bucket-name

# GCP configuration
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
PIPELINE_GCP_PROJECT=your-gcp-project
PIPELINE_GCP_GCS_BUCKET=your-gcs-bucket

# Azure configuration
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
PIPELINE_AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
```

### Configuration Files

The pipeline uses JSON configuration files for different environments:

- `config/development_config.json`: Development environment settings
- `config/production_config.json`: Production environment settings

You can customize these files to match your specific requirements.

## Running the Pipeline

### Command Line Interface

The pipeline can be run from the command line using the `pipeline_runner.py` script:

```
python -m data_pipeline.orchestration.pipeline_runner --env development --destination parquet
```

#### Command Line Options

- `--env`: Environment to run in (development, staging, production)
- `--last-run-timestamp`: Timestamp for incremental processing (ISO format)
- `--destination`: Output format (parquet, delta, jdbc, bigquery, synapse)
- `--skip-extract`: Skip the extraction phase
- `--skip-transform`: Skip the transformation phase
- `--skip-load`: Skip the loading phase
- `--extracted-data-path`: Path to load extracted data from
- `--transformed-data-path`: Path to load transformed data from

### Docker Execution

To run the pipeline using Docker:

```
docker-compose up data-pipeline
```

To run tests:

```
docker-compose up data-pipeline-test
```

## Pipeline Outputs

The pipeline generates several output datasets:

1. **Cleaned Transactions**: Basic cleaned transaction data
2. **Cleaned P2P Transfers**: Cleaned peer-to-peer transfer data
3. **Daily Transaction Aggregations**: Transactions aggregated by day, user, and status
4. **Daily P2P Transfer Aggregations**: P2P transfers aggregated by day and user
5. **User Metrics**: Comprehensive metrics for each user
6. **Transaction Anomalies**: Identified anomalous transactions
7. **Balance History**: Historical balance changes for each user

## Output Destinations

The pipeline supports multiple output destinations:

- **Parquet Files**: Default output format for local development
- **Delta Lake**: For systems supporting Delta format
- **JDBC Databases**: PostgreSQL and other databases
- **BigQuery**: Google Cloud's data warehouse
- **Synapse**: Azure Synapse Analytics

## Example Usage Scenarios

### Scenario 1: Daily Processing of New Transactions

```
python -m data_pipeline.orchestration.pipeline_runner \
  --env production \
  --last-run-timestamp "2025-08-10T00:00:00" \
  --destination delta
```

### Scenario 2: Full Reprocessing of All Data

```
python -m data_pipeline.orchestration.pipeline_runner \
  --env production \
  --destination bigquery
```

### Scenario 3: Run Transformations Only on Existing Extracted Data

```
python -m data_pipeline.orchestration.pipeline_runner \
  --skip-extract \
  --extracted-data-path "s3a://your-bucket/extracted-data" \
  --env production
```

## Monitoring and Troubleshooting

### Logs

Logs are written to the location specified in the configuration:
- Development: `/tmp/data-pipeline-dev.log`
- Production: `/var/log/data-pipeline/app.log`

### Common Issues

1. **Connection errors**:
   - Check database credentials
   - Verify network connectivity
   - Ensure proper permissions for cloud resources

2. **Out of memory errors**:
   - Increase Spark executor memory
   - Adjust partition counts
   - Optimize transformations with high memory usage

3. **Slow performance**:
   - Check for data skew
   - Optimize join operations
   - Increase parallelism
   - Use appropriate partitioning strategies

## Extending the Pipeline

### Adding New Data Sources

1. Create a new extractor class in the `extract` package
2. Implement the extraction logic
3. Add the new source to the `PipelineRunner` class

### Adding New Transformations

1. Add new methods to the `TransactionTransformer` class or create a new transformer
2. Integrate the transformation into the pipeline flow in `PipelineRunner`

### Supporting New Output Destinations

1. Add new methods to the `DataWriter` class
2. Update the CLI options to support the new destination