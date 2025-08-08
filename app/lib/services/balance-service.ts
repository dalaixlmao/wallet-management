"use server";

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
      updated_at: balance.updated_at,
    };
  }
  
  async lockFunds(userId: number, amount: number, purpose: string) {
    return prisma.$transaction(async (tx) => {
      // Lock the balance row
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${userId} FOR UPDATE`;
      
      // Check available balance
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
      
      // Increase locked amount
      await tx.balance.update({
        where: { userId },
        data: {
          locked: { increment: amount },
          updated_at: new Date(),
        },
      });
      
      // Return the lock record
      return {
        userId,
        lockedAmount: amount,
        purpose,
        timestamp: new Date(),
        totalLocked: balance.locked + amount,
        availableAfterLock: availableAmount - amount,
      };
    });
  }
  
  async unlockFunds(userId: number, amount: number, purpose: string) {
    return prisma.$transaction(async (tx) => {
      // Lock the balance row
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${userId} FOR UPDATE`;
      
      // Check current lock amount
      const balance = await tx.balance.findUnique({
        where: { userId },
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
          updated_at: new Date(),
        },
      });
      
      return {
        userId,
        unlockedAmount: amount,
        purpose,
        timestamp: new Date(),
        remainingLocked: balance.locked - amount,
      };
    });
  }
  
  async getBalanceHistory(userId: number, days: number = 30) {
    // Get the start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Find all transactions for this user
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { userId, timestamp: { gte: startDate } },
          {
            p2pTransfer: {
              toUserId: userId,
            },
            timestamp: { gte: startDate },
          },
        ],
      },
      orderBy: {
        timestamp: 'asc',
      },
      include: {
        p2pTransfer: {
          select: {
            fromUserId: true,
            toUserId: true,
          },
        },
      },
    });
    
    // Get current balance
    const currentBalance = await this.getUserBalance(userId);
    
    // Calculate balance over time
    const balanceHistory = [];
    let runningBalance = currentBalance.total;
    
    // Start from the end and work backwards
    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      
      if (tx.type === 'p2p') {
        if (tx.p2pTransfer?.fromUserId === userId) {
          // Money sent out
          runningBalance -= tx.amount;
        } else if (tx.p2pTransfer?.toUserId === userId) {
          // Money received
          runningBalance -= tx.amount;
        }
      } else if (tx.type === 'onramp' && tx.status === 'completed') {
        // Money added to wallet
        runningBalance -= tx.amount;
      }
      
      balanceHistory.unshift({
        timestamp: tx.timestamp,
        balance: runningBalance,
        transaction: {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
        },
      });
    }
    
    return balanceHistory;
  }
}

export const balanceService = new BalanceService();