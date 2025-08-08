# Transaction Patterns and Best Practices

This document outlines recommended patterns for implementing common transaction scenarios in the digital wallet application.

## User Balance Check

```typescript
async function getUserBalance(userId: number) {
  const balance = await prisma.balance.findUnique({
    where: { userId },
    select: {
      amount: true,
      locked: true,
      updated_at: true
    }
  });
  
  if (!balance) {
    throw new Error('Balance record not found');
  }
  
  return {
    total: balance.amount,
    available: balance.amount - balance.locked,
    locked: balance.locked,
    lastUpdated: balance.updated_at
  };
}
```

## P2P Money Transfer

Always use a transaction to ensure atomicity between balance updates and transaction recording:

```typescript
async function transferMoney(fromUserId: number, toNumber: string, amount: number) {
  // Input validation
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }
  
  return await prisma.$transaction(async (tx) => {
    // Find recipient by phone number
    const recipient = await tx.user.findUnique({
      where: { number: toNumber }
    });
    
    if (!recipient) {
      throw new Error('Recipient not found');
    }
    
    if (recipient.id === fromUserId) {
      throw new Error('Cannot transfer to yourself');
    }
    
    // Lock the rows to prevent race conditions
    await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${fromUserId} FOR UPDATE`;
    await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${recipient.id} FOR UPDATE`;
    
    // Check sender balance
    const senderBalance = await tx.balance.findUnique({
      where: { userId: fromUserId }
    });
    
    if (!senderBalance || senderBalance.amount < amount) {
      throw new Error('Insufficient funds');
    }
    
    // Check recipient balance exists
    const recipientBalance = await tx.balance.findUnique({
      where: { userId: recipient.id }
    });
    
    if (!recipientBalance) {
      throw new Error('Recipient balance record not found');
    }
    
    // Update balances
    await tx.balance.update({
      where: { userId: fromUserId },
      data: { 
        amount: { decrement: amount },
        updated_at: new Date()
      }
    });
    
    await tx.balance.update({
      where: { userId: recipient.id },
      data: { 
        amount: { increment: amount },
        updated_at: new Date()
      }
    });
    
    // Create transfer record
    const transfer = await tx.p2pTransfer.create({
      data: {
        fromUserId: fromUserId,
        toUserId: recipient.id,
        amount,
        timestamp: new Date(),
        status: 'completed'
      }
    });
    
    // Record in transaction ledger
    await tx.transaction.create({
      data: {
        type: 'p2p',
        amount,
        userId: fromUserId,
        status: 'completed',
        reference_id: transfer.id,
        reference_type: 'p2pTransfer'
      }
    });
    
    return {
      transferId: transfer.id,
      amount,
      recipient: {
        id: recipient.id,
        name: recipient.name,
        number: recipient.number
      },
      timestamp: transfer.timestamp
    };
  });
}
```

## OnRamp Transaction (Adding Money to Wallet)

```typescript
async function createOnRampTransaction(userId: number, provider: string, amount: number, paymentMethod: string) {
  // Generate unique token
  const token = `onramp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  return await prisma.$transaction(async (tx) => {
    // Create initial pending transaction
    const onramp = await tx.onRampTransaction.create({
      data: {
        userId,
        provider,
        amount,
        token,
        status: 'Processing',
        startTime: new Date(),
        payment_method: paymentMethod,
        payment_details: {
          initiated_at: new Date().toISOString()
        }
      }
    });
    
    // Create transaction record
    await tx.transaction.create({
      data: {
        type: 'onramp',
        amount,
        userId,
        status: 'processing',
        reference_id: onramp.id,
        reference_type: 'OnRampTransaction'
      }
    });
    
    return {
      transactionId: onramp.id,
      token,
      status: 'Processing'
    };
  });
}

async function completeOnRampTransaction(token: string, success: boolean) {
  return await prisma.$transaction(async (tx) => {
    // Find the pending transaction
    const onramp = await tx.onRampTransaction.findUnique({
      where: { token }
    });
    
    if (!onramp) {
      throw new Error('Transaction not found');
    }
    
    if (onramp.status !== 'Processing') {
      throw new Error('Transaction already processed');
    }
    
    // Update onramp status
    const status = success ? 'Success' : 'Failure';
    await tx.onRampTransaction.update({
      where: { id: onramp.id },
      data: {
        status,
        payment_details: {
          ...(onramp.payment_details as any || {}),
          completed_at: new Date().toISOString(),
          success
        }
      }
    });
    
    // Update transaction record
    await tx.transaction.updateMany({
      where: {
        reference_id: onramp.id,
        reference_type: 'OnRampTransaction'
      },
      data: {
        status: success ? 'completed' : 'failed'
      }
    });
    
    // If successful, update user balance
    if (success) {
      // Lock the balance row
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${onramp.userId} FOR UPDATE`;
      
      // Get current balance
      const balance = await tx.balance.findUnique({
        where: { userId: onramp.userId }
      });
      
      if (!balance) {
        // Create balance if it doesn't exist
        await tx.balance.create({
          data: {
            userId: onramp.userId,
            amount: onramp.amount,
            locked: 0
          }
        });
      } else {
        // Update existing balance
        await tx.balance.update({
          where: { userId: onramp.userId },
          data: {
            amount: { increment: onramp.amount },
            updated_at: new Date()
          }
        });
      }
    }
    
    return {
      transactionId: onramp.id,
      status,
      success
    };
  });
}
```

## Transaction History Query

Efficient query to get a user's transaction history:

```typescript
async function getUserTransactionHistory(userId: number, options = {
  limit: 20,
  offset: 0,
  type: null,
  startDate: null,
  endDate: null
}) {
  // Build where clause dynamically
  const where: any = { userId };
  
  if (options.type) {
    where.type = options.type;
  }
  
  if (options.startDate || options.endDate) {
    where.timestamp = {};
    if (options.startDate) {
      where.timestamp.gte = options.startDate;
    }
    if (options.endDate) {
      where.timestamp.lte = options.endDate;
    }
  }
  
  // Get transactions with appropriate details based on type
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: {
      timestamp: 'desc'
    },
    skip: options.offset,
    take: options.limit,
    include: {
      // Include relevant fields based on transaction type
      p2pTransfer: {
        select: {
          fromUser: {
            select: { name: true, number: true }
          },
          toUser: {
            select: { name: true, number: true }
          }
        }
      },
      onrampTransaction: {
        select: {
          provider: true,
          payment_method: true
        }
      }
    }
  });
  
  // Transform to user-friendly format
  return transactions.map(tx => {
    const base = {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      timestamp: tx.timestamp,
      status: tx.status
    };
    
    // Add type-specific details
    if (tx.type === 'p2p' && tx.p2pTransfer) {
      return {
        ...base,
        details: {
          from: tx.p2pTransfer.fromUser,
          to: tx.p2pTransfer.toUser,
          direction: tx.p2pTransfer.fromUser.id === userId ? 'outgoing' : 'incoming'
        }
      };
    } else if (tx.type === 'onramp' && tx.onrampTransaction) {
      return {
        ...base,
        details: {
          provider: tx.onrampTransaction.provider,
          payment_method: tx.onrampTransaction.payment_method
        }
      };
    }
    
    return base;
  });
}
```

## Locking Funds (Reserved Balance)

For operations that need to reserve funds before finalizing:

```typescript
async function lockFunds(userId: number, amount: number, purpose: string) {
  return await prisma.$transaction(async (tx) => {
    // Lock the balance row
    await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${userId} FOR UPDATE`;
    
    // Check available balance
    const balance = await tx.balance.findUnique({
      where: { userId }
    });
    
    if (!balance) {
      throw new Error('Balance not found');
    }
    
    const availableAmount = balance.amount - balance.locked;
    if (availableAmount < amount) {
      throw new Error('Insufficient available funds');
    }
    
    // Increase locked amount
    await tx.balance.update({
      where: { userId },
      data: {
        locked: { increment: amount },
        updated_at: new Date()
      }
    });
    
    // Return the lock record
    return {
      userId,
      lockedAmount: amount,
      purpose,
      timestamp: new Date(),
      totalLocked: balance.locked + amount,
      availableAfterLock: availableAmount - amount
    };
  });
}

async function unlockFunds(userId: number, amount: number, purpose: string) {
  return await prisma.$transaction(async (tx) => {
    // Lock the balance row
    await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${userId} FOR UPDATE`;
    
    // Check current lock amount
    const balance = await tx.balance.findUnique({
      where: { userId }
    });
    
    if (!balance) {
      throw new Error('Balance not found');
    }
    
    if (balance.locked < amount) {
      throw new Error('Attempted to unlock more than locked amount');
    }
    
    // Decrease locked amount
    await tx.balance.update({
      where: { userId },
      data: {
        locked: { decrement: amount },
        updated_at: new Date()
      }
    });
    
    return {
      userId,
      unlockedAmount: amount,
      purpose,
      timestamp: new Date(),
      remainingLocked: balance.locked - amount
    };
  });
}
```

## Database Health Check

Utility function to verify database connectivity and integrity:

```typescript
async function checkDatabaseHealth() {
  try {
    // Check basic connectivity with a simple query
    const result = await prisma.$queryRaw`SELECT 1 as healthy`;
    
    // Check if critical tables exist and are accessible
    const userCount = await prisma.user.count();
    const balanceCount = await prisma.balance.count();
    const p2pCount = await prisma.p2pTransfer.count();
    const onrampCount = await prisma.onRampTransaction.count();
    
    return {
      healthy: true,
      stats: {
        users: userCount,
        balances: balanceCount,
        p2pTransfers: p2pCount,
        onrampTransactions: onrampCount
      },
      timestamp: new Date()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}
```