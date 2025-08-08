# Data Access Layer Architecture

This document outlines the architecture of the data access layer for the digital wallet application, providing guidance on best practices for interacting with the database.

## Overview

The data access layer is built on Prisma ORM, which provides type-safe database access with TypeScript. The application uses PostgreSQL as the primary database, with potential for Redis caching in the future.

## Architecture

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│                │     │                │     │                │
│ API Routes     │     │ Server Actions │     │ Background     │
│                │     │                │     │ Jobs           │
└───────┬────────┘     └───────┬────────┘     └───────┬────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    Data Access Services                      │
│                                                              │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                     Prisma Client                            │
│                                                              │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                     PostgreSQL                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Components

### 1. Prisma Schema

The Prisma schema (`prisma/schema.prisma`) defines the database structure and relationships. It serves as the single source of truth for your database schema.

### 2. Data Access Services

Create dedicated service modules for different entities to encapsulate database logic:

```
/app
  /lib
    /services
      /user-service.ts
      /balance-service.ts
      /transaction-service.ts
      /p2p-service.ts
      /onramp-service.ts
```

### 3. Prisma Client Instance

Maintain a singleton instance of the Prisma client to prevent connection leaks:

```typescript
// /app/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Best Practices

### 1. Service Layer Pattern

Implement a service layer to encapsulate database operations:

```typescript
// /app/lib/services/user-service.ts
import { prisma } from '../prisma';
import { hash, compare } from 'bcrypt';

export class UserService {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByPhone(number: string) {
    return prisma.user.findUnique({ where: { number } });
  }

  async create(data: {
    email: string;
    password: string;
    name?: string;
    number: string;
  }) {
    const hashedPassword = await hash(data.password, 10);
    
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
          number: data.number,
        },
      });

      // Initialize balance for new user
      await tx.balance.create({
        data: {
          userId: user.id,
          amount: 0,
          locked: 0,
        },
      });

      return user;
    });
  }

  async validatePassword(userId: number, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) return false;
    
    return compare(password, user.password);
  }
}

export const userService = new UserService();
```

### 2. Transaction Management

Always use transactions for operations that modify multiple tables:

```typescript
// /app/lib/services/p2p-service.ts
import { prisma } from '../prisma';

export class P2PService {
  async transfer(fromUserId: number, toNumber: string, amount: number) {
    return prisma.$transaction(async (tx) => {
      // Find recipient
      const recipient = await tx.user.findUnique({
        where: { number: toNumber },
      });

      if (!recipient) {
        throw new Error('Recipient not found');
      }

      if (recipient.id === fromUserId) {
        throw new Error('Cannot transfer to yourself');
      }

      // Lock rows for update
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${fromUserId} FOR UPDATE`;
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${recipient.id} FOR UPDATE`;

      // Verify sender has sufficient balance
      const senderBalance = await tx.balance.findUnique({
        where: { userId: fromUserId },
      });

      if (!senderBalance || senderBalance.amount < amount) {
        throw new Error('Insufficient funds');
      }

      // Update balances
      await tx.balance.update({
        where: { userId: fromUserId },
        data: { amount: { decrement: amount } },
      });

      await tx.balance.update({
        where: { userId: recipient.id },
        data: { amount: { increment: amount } },
      });

      // Create transfer record
      const transfer = await tx.p2pTransfer.create({
        data: {
          fromUserId,
          toUserId: recipient.id,
          amount,
          timestamp: new Date(),
        },
      });

      // Record in transaction ledger
      await tx.transaction.create({
        data: {
          type: 'p2p',
          amount,
          userId: fromUserId,
          status: 'completed',
          reference_id: transfer.id,
          reference_type: 'p2pTransfer',
        },
      });

      return transfer;
    });
  }
}

export const p2pService = new P2PService();
```

### 3. Error Handling

Implement consistent error handling for database operations:

```typescript
// /app/lib/db-error.ts
import { Prisma } from '@prisma/client';

export class DatabaseError extends Error {
  code: string;
  meta?: any;
  
  constructor(error: any) {
    super(error.message);
    this.name = 'DatabaseError';
    this.code = error.code;
    this.meta = error.meta;
  }
  
  static handle(error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
      switch (error.code) {
        case 'P2002':
          return new DatabaseError({
            message: `A record with this ${error.meta?.target} already exists`,
            code: 'UNIQUE_CONSTRAINT',
            meta: error.meta
          });
        case 'P2025':
          return new DatabaseError({
            message: 'Record not found',
            code: 'NOT_FOUND',
            meta: error.meta
          });
        default:
          return new DatabaseError({
            message: error.message,
            code: error.code,
            meta: error.meta
          });
      }
    }
    
    if (error instanceof Prisma.PrismaClientValidationError) {
      return new DatabaseError({
        message: 'Validation error in database query',
        code: 'VALIDATION_ERROR'
      });
    }
    
    return error;
  }
}

// Usage example
import { DatabaseError } from '../db-error';

try {
  const result = await userService.create({ /* user data */ });
  return result;
} catch (error) {
  throw DatabaseError.handle(error);
}
```

### 4. Query Optimization

Optimize database queries by selecting only the fields you need:

```typescript
// BAD: Retrieves all fields
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// GOOD: Retrieves only needed fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    email: true
  }
});
```

### 5. Connection Management

For serverless environments, implement connection pooling:

```typescript
// /app/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    // Recommended options for serverless environments
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool settings
    __internal: {
      engine: {
        connectionLimit: 5, // Adjust based on provider limits
      },
    },
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export { prisma };

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Data Model Usage Patterns

### User Authentication

```typescript
// Inside authentication API route
import { userService } from '@/lib/services/user-service';
import { compare } from 'bcrypt';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  
  const user = await userService.findByEmail(email);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
    });
  }
  
  const isValidPassword = await compare(password, user.password);
  if (!isValidPassword) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
    });
  }
  
  // Create session, etc.
}
```

### Balance Management

```typescript
// Inside balance service
import { prisma } from '../prisma';

export class BalanceService {
  async getUserBalance(userId: number) {
    const balance = await prisma.balance.findUnique({
      where: { userId },
    });
    
    if (!balance) {
      throw new Error('Balance record not found');
    }
    
    return {
      total: balance.amount,
      available: balance.amount - balance.locked,
      locked: balance.locked,
    };
  }
  
  async lockFunds(userId: number, amount: number) {
    return prisma.$transaction(async (tx) => {
      // Lock row for update
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${userId} FOR UPDATE`;
      
      const balance = await tx.balance.findUnique({
        where: { userId },
      });
      
      if (!balance) {
        throw new Error('Balance not found');
      }
      
      const availableAmount = balance.amount - balance.locked;
      if (availableAmount < amount) {
        throw new Error('Insufficient available funds');
      }
      
      return tx.balance.update({
        where: { userId },
        data: {
          locked: { increment: amount },
        },
      });
    });
  }
}

export const balanceService = new BalanceService();
```

## Performance Monitoring

Implement query performance monitoring in development environments:

```typescript
// /app/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

// Log query performance in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    console.log(`Query: ${e.query}`);
    console.log(`Duration: ${e.duration}ms`);
  });
}

export { prisma };
```

## Data Validation

Use Zod for input validation before database operations:

```typescript
// /app/lib/validation/user-schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  number: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Usage in service
import { createUserSchema } from '../validation/user-schema';

async function createUser(data: unknown) {
  // Validate and parse input
  const validatedData = createUserSchema.parse(data);
  
  // Proceed with database operation
  return prisma.user.create({
    data: {
      ...validatedData,
      password: await hash(validatedData.password, 10),
    },
  });
}
```

## Conclusion

Following these architecture patterns and best practices will help ensure a robust, performant, and maintainable data access layer for the digital wallet application. The separation of concerns through service layers and proper transaction management will provide a solid foundation as the application grows.