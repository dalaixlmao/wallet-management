-- Add new timestamp fields to User
ALTER TABLE "User" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at field to Balance
ALTER TABLE "Balance" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add status field to P2PTransfer
ALTER TABLE "p2pTransfer" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed';

-- Add additional fields to OnRampTransaction
ALTER TABLE "OnRampTransaction" ADD COLUMN "payment_method" TEXT;
ALTER TABLE "OnRampTransaction" ADD COLUMN "payment_details" JSONB;

-- Add additional fields to Merchant
ALTER TABLE "Merchant" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Merchant" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE;

-- Create Session table
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  "session_token" TEXT NOT NULL,
  
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Create Transaction table (unified ledger)
CREATE TABLE "Transaction" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "reference_id" INTEGER NOT NULL,
  "reference_type" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "merchantId" INTEGER,
  
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance
CREATE INDEX "p2pTransfer_fromUserId_idx" ON "p2pTransfer"("fromUserId");
CREATE INDEX "p2pTransfer_toUserId_idx" ON "p2pTransfer"("toUserId");
CREATE INDEX "p2pTransfer_timestamp_idx" ON "p2pTransfer"("timestamp");

CREATE INDEX "OnRampTransaction_userId_idx" ON "OnRampTransaction"("userId");
CREATE INDEX "OnRampTransaction_startTime_idx" ON "OnRampTransaction"("startTime");

CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Transaction_merchantId_idx" ON "Transaction"("merchantId");
CREATE INDEX "Transaction_timestamp_idx" ON "Transaction"("timestamp");
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX "Session_session_token_key" ON "Session"("session_token");

-- Add foreign key constraints
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;