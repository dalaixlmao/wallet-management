# Data Models

This document describes the database schema and data models used in the Digital Banking Platform.

## Database Schema

The platform uses PostgreSQL with Prisma as the ORM. Below is the Prisma schema that defines the database structure:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                Int                 @id @default(autoincrement())
  email             String?             @unique
  name              String?
  number            String              @unique
  password          String
  OnRampTransaction OnRampTransaction[]
  Balance           Balance[]
  sentTransfers     p2pTransfer[]       @relation(name: "FromUserRelation")
  receivedTransfers p2pTransfer[]       @relation(name: "ToUserRelation")
}

model p2pTransfer {
  id         Int          @id @default(autoincrement())
  amount     Int
  timestamp  DateTime
  fromUserId Int
  fromUser   User         @relation(name: "FromUserRelation", fields: [fromUserId], references: [id])
  toUserId   Int
  toUser     User         @relation(name: "ToUserRelation", fields: [toUserId], references: [id])
}

model Merchant {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  auth_type AuthType
}

model OnRampTransaction {
  id        Int          @id @default(autoincrement())
  status    OnRampStatus
  token     String       @unique
  provider  String
  amount    Int
  startTime DateTime
  userId    Int
  user      User         @relation(fields: [userId], references: [id])
}

model Balance {
  id     Int  @id @default(autoincrement())
  userId Int  @unique
  amount Int
  locked Int
  user   User @relation(fields: [userId], references: [id])
}

enum AuthType {
  Google
  Github
}

enum OnRampStatus {
  Success
  Failure
  Processing
}
```

## Model Descriptions

### User

Represents a user of the platform.

| Field               | Type                | Description                              |
|---------------------|---------------------|------------------------------------------|
| id                  | Int                 | Primary key                              |
| email               | String? (optional)  | User's email address (unique)            |
| name                | String? (optional)  | User's display name                      |
| number              | String              | User's phone number (unique)             |
| password            | String              | Hashed password                          |
| OnRampTransaction   | OnRampTransaction[] | Transactions adding money to account     |
| Balance             | Balance[]           | User's account balance                   |
| sentTransfers       | p2pTransfer[]       | Transfers sent by this user              |
| receivedTransfers   | p2pTransfer[]       | Transfers received by this user          |

### p2pTransfer

Represents a peer-to-peer money transfer between users.

| Field       | Type     | Description                                   |
|-------------|----------|-----------------------------------------------|
| id          | Int      | Primary key                                   |
| amount      | Int      | Transfer amount (in base units)               |
| timestamp   | DateTime | When the transfer occurred                    |
| fromUserId  | Int      | ID of the user sending money                  |
| fromUser    | User     | Relation to the sending user                  |
| toUserId    | Int      | ID of the user receiving money                |
| toUser      | User     | Relation to the receiving user                |

### Merchant

Represents a merchant that can be used for authentication.

| Field     | Type     | Description                          |
|-----------|----------|--------------------------------------|
| id        | Int      | Primary key                          |
| email     | String   | Merchant email address (unique)      |
| name      | String?  | Merchant name (optional)             |
| auth_type | AuthType | Authentication type (enum)           |

### OnRampTransaction

Represents a transaction that adds money to a user's account.

| Field     | Type         | Description                            |
|-----------|--------------|----------------------------------------|
| id        | Int          | Primary key                            |
| status    | OnRampStatus | Transaction status (enum)              |
| token     | String       | Unique transaction identifier          |
| provider  | String       | Payment provider name                  |
| amount    | Int          | Transaction amount (in base units)     |
| startTime | DateTime     | When the transaction was initiated     |
| userId    | Int          | ID of the user receiving the money     |
| user      | User         | Relation to the user                   |

### Balance

Represents a user's account balance.

| Field  | Type | Description                                |
|--------|----- |-------------------------------------------|
| id     | Int  | Primary key                               |
| userId | Int  | User ID (unique)                          |
| amount | Int  | Available balance amount (in base units)  |
| locked | Int  | Amount that is locked/pending             |
| user   | User | Relation to the user                      |

## Enums

### AuthType

Authentication types for merchants.

| Value  | Description                    |
|--------|--------------------------------|
| Google | Google OAuth authentication    |
| Github | GitHub OAuth authentication    |

### OnRampStatus

Status values for on-ramp transactions.

| Value      | Description                         |
|------------|-------------------------------------|
| Success    | Transaction completed successfully  |
| Failure    | Transaction failed                  |
| Processing | Transaction is being processed      |

## Relationships

- A **User** can have many **OnRampTransactions** (one-to-many)
- A **User** has one **Balance** record (one-to-one)
- A **User** can send many **p2pTransfers** (one-to-many)
- A **User** can receive many **p2pTransfers** (one-to-many)

## Notes on Amount Fields

All monetary amount fields (such as `amount` in the Balance and transaction models) are stored as integers representing the smallest currency unit (e.g., cents for USD). To convert to the display amount, divide by 100.