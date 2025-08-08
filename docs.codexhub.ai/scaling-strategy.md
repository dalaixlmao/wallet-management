# Database Scaling Strategy

This document outlines the strategies for scaling the digital wallet application's database infrastructure as the user base and transaction volume grow.

## Current Architecture

The application currently uses:

- PostgreSQL as the primary database
- Prisma ORM for database access
- Transaction-based operations for data integrity

## Scaling Challenges

As the digital wallet application grows, we anticipate the following challenges:

1. **Increasing transaction volume** - More users performing more transfers
2. **Growing historical data** - Accumulating transaction history
3. **Read vs. write patterns** - Higher read-to-write ratio for balance checks
4. **Peak traffic handling** - Spikes during high-activity periods
5. **Reporting and analytics** - More complex queries for business intelligence

## Scaling Strategies

### 1. Vertical Scaling (Short-term)

Initially, scaling up the database server resources is the simplest approach:

- Increase CPU, memory, and disk resources
- Optimize PostgreSQL configuration for higher workloads
- Tune connection pooling settings

**Implementation:**

```
# Example PostgreSQL performance tuning parameters
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 20MB
min_wal_size = 2GB
max_wal_size = 8GB
```

### 2. Connection Pooling (Short-term)

Implement PgBouncer to manage database connections efficiently:

```yaml
# Example docker-compose config for PgBouncer
services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_HOST=postgres
      - DB_NAME=wallet
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=3000
      - DEFAULT_POOL_SIZE=100
    ports:
      - "6432:5432"
    depends_on:
      - postgres
```

Update Prisma connection string:

```
DATABASE_URL="postgresql://postgres:postgres@pgbouncer:6432/wallet?pgbouncer=true"
```

### 3. Read Replicas (Mid-term)

Implement PostgreSQL read replicas to separate read and write operations:

![Read Replica Architecture](https://via.placeholder.com/800x400?text=Read+Replica+Architecture)

**Implementation Steps:**

1. Configure PostgreSQL for replication:

```
# In postgresql.conf (primary)
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10

# In pg_hba.conf (primary)
host replication replicator 10.0.0.0/24 md5
```

2. Create replica instances and set up replication.

3. Update application code to route queries:

```typescript
// /app/lib/db.ts
import { PrismaClient } from '@prisma/client';

// Primary database for writes
const primaryDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRIMARY_DATABASE_URL,
    },
  },
});

// Read replica for queries
const replicaDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.REPLICA_DATABASE_URL,
    },
  },
});

// Helper function to determine if operation is read-only
function isReadOperation(method: string, model?: string) {
  const readMethods = ['findUnique', 'findMany', 'findFirst', 'count', 'aggregate'];
  return readMethods.includes(method);
}

// Proxy to route queries to appropriate database
export const prisma = new Proxy({}, {
  get: (_, model: string) => {
    if (model === '$transaction' || model === '$connect' || model === '$disconnect') {
      return primaryDb[model].bind(primaryDb);
    }
    
    return new Proxy({}, {
      get: (_, method: string) => {
        const db = isReadOperation(method) ? replicaDb : primaryDb;
        return db[model][method].bind(db[model]);
      }
    });
  }
}) as PrismaClient;
```

### 4. Caching Layer with Redis (Mid-term)

Introduce Redis for caching frequently accessed data:

![Redis Caching Architecture](https://via.placeholder.com/800x400?text=Redis+Caching+Architecture)

**Implementation:**

```typescript
// /app/lib/services/balance-cache.ts
import { Redis } from 'ioredis';
import { prisma } from '../prisma';

const redis = new Redis(process.env.REDIS_URL);
const CACHE_TTL = 60; // 1 minute

export class BalanceCacheService {
  private cacheKey(userId: number): string {
    return `balance:${userId}`;
  }
  
  async getUserBalance(userId: number) {
    // Try cache first
    const cachedBalance = await redis.get(this.cacheKey(userId));
    
    if (cachedBalance) {
      return JSON.parse(cachedBalance);
    }
    
    // Cache miss, get from database
    const balance = await prisma.balance.findUnique({
      where: { userId },
    });
    
    if (!balance) {
      throw new Error('Balance record not found');
    }
    
    const result = {
      total: balance.amount,
      available: balance.amount - balance.locked,
      locked: balance.locked,
      lastUpdated: balance.updated_at,
    };
    
    // Store in cache
    await redis.set(
      this.cacheKey(userId),
      JSON.stringify(result),
      'EX',
      CACHE_TTL
    );
    
    return result;
  }
  
  async invalidateUserBalance(userId: number) {
    await redis.del(this.cacheKey(userId));
  }
}

export const balanceCache = new BalanceCacheService();
```

Update transaction services to invalidate cache:

```typescript
// In p2p transfer service
async transfer(fromUserId: number, toNumber: string, amount: number) {
  const result = await prisma.$transaction(async (tx) => {
    // ... existing transaction logic ...
  });
  
  // Invalidate cache for both users
  await balanceCache.invalidateUserBalance(fromUserId);
  await balanceCache.invalidateUserBalance(result.toUserId);
  
  return result;
}
```

### 5. Database Sharding (Long-term)

For very large scale, implement database sharding by user ID:

![Database Sharding Architecture](https://via.placeholder.com/800x400?text=Database+Sharding+Architecture)

**Implementation Strategy:**

1. Create a routing layer to determine shard location:

```typescript
// /app/lib/db-sharding.ts
import { PrismaClient } from '@prisma/client';

// Create connection to each shard
const shards = [
  new PrismaClient({ 
    datasources: { db: { url: process.env.SHARD_0_URL } } 
  }),
  new PrismaClient({ 
    datasources: { db: { url: process.env.SHARD_1_URL } } 
  }),
  // Add more shards as needed
];

// Function to determine shard for a user
function getUserShard(userId: number) {
  return shards[userId % shards.length];
}

// Example usage
export async function getUserBalance(userId: number) {
  const shard = getUserShard(userId);
  return shard.balance.findUnique({
    where: { userId },
  });
}
```

2. Implement cross-shard transactions for transfers between users on different shards:

```typescript
async function crossShardTransfer(fromUserId: number, toUserId: number, amount: number) {
  // Determine shards for each user
  const fromShard = getUserShard(fromUserId);
  const toShard = getUserShard(toUserId);
  
  // If same shard, use regular transaction
  if (fromShard === toShard) {
    return regularTransfer(fromUserId, toUserId, amount);
  }
  
  // Cross-shard transaction using two-phase commit
  // 1. Prepare phase - lock funds on both shards
  const prepareId = generateTransactionId();
  
  try {
    // Lock funds on sender's shard
    await fromShard.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${fromUserId} FOR UPDATE`;
      const balance = await tx.balance.findUnique({ where: { userId: fromUserId } });
      
      if (!balance || balance.amount < amount) {
        throw new Error('Insufficient funds');
      }
      
      await tx.balance.update({
        where: { userId: fromUserId },
        data: { 
          locked: { increment: amount },
          updated_at: new Date()
        },
      });
      
      await tx.pendingTransaction.create({
        data: {
          id: prepareId,
          userId: fromUserId,
          amount,
          type: 'outgoing',
          status: 'prepared',
          created_at: new Date()
        }
      });
    });
    
    // Record on receiver's shard
    await toShard.$transaction(async (tx) => {
      await tx.pendingTransaction.create({
        data: {
          id: prepareId,
          userId: toUserId,
          amount,
          type: 'incoming',
          status: 'prepared',
          created_at: new Date()
        }
      });
    });
    
    // 2. Commit phase
    // Complete on sender's shard
    await fromShard.$transaction(async (tx) => {
      await tx.balance.update({
        where: { userId: fromUserId },
        data: {
          amount: { decrement: amount },
          locked: { decrement: amount },
          updated_at: new Date()
        }
      });
      
      await tx.pendingTransaction.update({
        where: { id: prepareId },
        data: { status: 'completed' }
      });
      
      await tx.p2pTransfer.create({
        data: {
          fromUserId,
          toUserId,
          amount,
          timestamp: new Date(),
          status: 'completed'
        }
      });
    });
    
    // Complete on receiver's shard
    await toShard.$transaction(async (tx) => {
      await tx.balance.update({
        where: { userId: toUserId },
        data: {
          amount: { increment: amount },
          updated_at: new Date()
        }
      });
      
      await tx.pendingTransaction.update({
        where: { id: prepareId },
        data: { status: 'completed' }
      });
      
      await tx.p2pTransfer.create({
        data: {
          fromUserId,
          toUserId,
          amount,
          timestamp: new Date(),
          status: 'completed'
        }
      });
    });
    
    return { status: 'success', transactionId: prepareId };
  } catch (error) {
    // Rollback if any step fails
    try {
      await fromShard.$transaction(async (tx) => {
        const pending = await tx.pendingTransaction.findUnique({
          where: { id: prepareId }
        });
        
        if (pending && pending.status === 'prepared') {
          await tx.balance.update({
            where: { userId: fromUserId },
            data: { locked: { decrement: amount } }
          });
          
          await tx.pendingTransaction.update({
            where: { id: prepareId },
            data: { status: 'failed' }
          });
        }
      });
      
      await toShard.$transaction(async (tx) => {
        const pending = await tx.pendingTransaction.findUnique({
          where: { id: prepareId }
        });
        
        if (pending) {
          await tx.pendingTransaction.update({
            where: { id: prepareId },
            data: { status: 'failed' }
          });
        }
      });
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    
    throw new Error(`Cross-shard transfer failed: ${error.message}`);
  }
}
```

### 6. Analytics Database (Long-term)

Implement a dedicated analytics database using ClickHouse:

![Analytics Database Architecture](https://via.placeholder.com/800x400?text=Analytics+Database+Architecture)

**Implementation:**

1. Set up data replication from PostgreSQL to ClickHouse using Change Data Capture (CDC).

2. Create optimized schemas in ClickHouse for analytics:

```sql
CREATE TABLE wallet.transactions
(
    id UInt64,
    user_id UInt64,
    merchant_id Nullable(UInt64),
    type String,
    amount Int64,
    timestamp DateTime,
    status String,
    reference_id UInt64,
    reference_type String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp)
SETTINGS index_granularity = 8192;
```

3. Implement an analytics service:

```typescript
// /app/lib/analytics/transaction-analytics.ts
import { ClickHouseClient } from '@clickhouse/client';

const client = new ClickHouseClient({
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

export class TransactionAnalyticsService {
  async getUserTransactionSummary(userId: number, period: 'day' | 'week' | 'month' = 'month') {
    const timeFunction = {
      day: 'toDate',
      week: 'toMonday',
      month: 'toStartOfMonth',
    }[period];
    
    const query = `
      SELECT
        ${timeFunction}(timestamp) AS period,
        type,
        COUNT() AS count,
        SUM(amount) AS total_amount
      FROM wallet.transactions
      WHERE user_id = {userId:UInt64}
        AND timestamp >= now() - INTERVAL 1 YEAR
      GROUP BY period, type
      ORDER BY period DESC, type
    `;
    
    const resultSet = await client.query({
      query,
      query_params: { userId },
      format: 'JSONEachRow',
    });
    
    return resultSet.json();
  }
  
  async getTransactionVolumeByHour(days: number = 7) {
    const query = `
      SELECT
        toHour(timestamp) AS hour,
        COUNT() AS count,
        SUM(amount) AS total_amount
      FROM wallet.transactions
      WHERE timestamp >= now() - INTERVAL ${days} DAY
      GROUP BY hour
      ORDER BY hour
    `;
    
    const resultSet = await client.query({
      query,
      format: 'JSONEachRow',
    });
    
    return resultSet.json();
  }
}

export const transactionAnalytics = new TransactionAnalyticsService();
```

## Database Backup Strategy

Implement a comprehensive backup strategy:

1. **Regular Full Backups**:
   ```bash
   # Daily full backup
   pg_dump -Fc -f /backups/wallet_$(date +%Y%m%d).dump -d wallet
   ```

2. **WAL Archiving for Point-in-Time Recovery**:
   ```
   # In postgresql.conf
   wal_level = replica
   archive_mode = on
   archive_command = 'cp %p /var/lib/postgresql/archive/%f'
   ```

3. **Regular Backup Testing**:
   ```bash
   # Monthly backup restore test
   createdb wallet_test
   pg_restore -d wallet_test /backups/wallet_latest.dump
   ```

## Monitoring and Alerts

Implement comprehensive monitoring:

1. **Key Metrics to Monitor**:
   - Query performance (slow queries)
   - Connection pool utilization
   - Transaction throughput
   - Database size and growth
   - Replication lag
   - Cache hit/miss ratio

2. **Alert Thresholds**:
   - Query duration > 1 second
   - Connection pool at > 80% capacity
   - Replication lag > 30 seconds
   - Database disk usage > 80%

## Conclusion

This scaling strategy provides a roadmap from the current architecture to a highly scalable database infrastructure that can support millions of users and transactions. By implementing these strategies incrementally as needed, we can ensure the digital wallet application remains performant and reliable as it grows.

Each scaling phase should be preceded by thorough load testing and followed by careful monitoring to ensure the changes achieve the desired performance improvements.