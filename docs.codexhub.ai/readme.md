# Digital Wallet Database Architecture

This folder contains comprehensive documentation for the database design and data access patterns implemented in the digital wallet application. The design focuses on scalability, reliability, and performance for financial transactions.

## Documentation Index

1. **[Database Design](./database-design.md)**
   - Core schema definitions
   - Entity relationships
   - Indexing strategy
   - Data integrity considerations

2. **[Data Access Layer](./data-access-layer.md)**
   - Service layer architecture
   - Prisma integration
   - Transaction management
   - Error handling

3. **[Transaction Patterns](./examples/transaction-patterns.md)**
   - Common transaction scenarios
   - Code examples for balance operations
   - P2P transfers
   - OnRamp processes

4. **[Scaling Strategy](./scaling-strategy.md)**
   - Vertical and horizontal scaling approaches
   - Caching with Redis
   - Read replicas
   - Sharding considerations
   - Analytics database

## Implementation Files

The database architecture is implemented through the following key files:

1. **Schema Definition**
   - `/prisma/schema.prisma` - Core schema definition
   - `/prisma/migrations/` - Database migration files

2. **Data Access Services**
   - `/app/lib/prisma.ts` - Prisma client configuration
   - `/app/lib/services/user-service.ts` - User management
   - `/app/lib/services/balance-service.ts` - Balance operations
   - `/app/lib/services/transaction-service.ts` - Transaction history and reporting
   - `/app/lib/services/p2p-service.ts` - Peer-to-peer transfers
   - `/app/lib/services/onramp-service.ts` - Adding money to the platform

## Getting Started

To initialize the database:

1. Ensure PostgreSQL is installed and running
2. Configure the DATABASE_URL in .env
3. Run `npx prisma migrate deploy` to apply all migrations
4. Run `npx prisma generate` to generate the Prisma client

## Database Schema Overview

The schema is designed around these core entities:

- **User** - Account holders in the system
- **Balance** - Financial balance for each user
- **P2PTransfer** - Money transfers between users
- **OnRampTransaction** - Money added to the platform
- **Transaction** - Unified ledger for all financial activities
- **Merchant** - Business entities that interact with the system
- **Session** - User authentication sessions

For complete details, see the [Database Design](./database-design.md) document.