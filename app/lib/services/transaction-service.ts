"use server";

import { prisma } from '../prisma';
import { z } from 'zod';

// Input validation schema
const transactionFilterSchema = z.object({
  userId: z.number(),
  type: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export class TransactionService {
  async getTransactionHistory(filters: {
    userId: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    // Validate input
    const validFilters = transactionFilterSchema.parse(filters);
    
    // Build the where clause
    const where: any = { userId: validFilters.userId };
    
    if (validFilters.type) {
      where.type = validFilters.type;
    }
    
    if (validFilters.startDate || validFilters.endDate) {
      where.timestamp = {};
      if (validFilters.startDate) {
        where.timestamp.gte = validFilters.startDate;
      }
      if (validFilters.endDate) {
        where.timestamp.lte = validFilters.endDate;
      }
    }
    
    // Get transactions with appropriate details based on type
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      skip: validFilters.offset,
      take: validFilters.limit,
      include: {
        // Include relevant fields based on transaction type
        p2pTransfer: {
          select: {
            fromUser: {
              select: { name: true, number: true },
            },
            toUser: {
              select: { name: true, number: true },
            },
          },
        },
        onrampTransaction: {
          select: {
            provider: true,
            payment_method: true,
          },
        },
      },
    });
    
    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where });
    
    // Transform to user-friendly format
    return {
      transactions: transactions.map(tx => {
        const base = {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          timestamp: tx.timestamp,
          status: tx.status,
        };
        
        // Add type-specific details
        if (tx.type === 'p2p' && tx.p2pTransfer) {
          return {
            ...base,
            details: {
              from: tx.p2pTransfer.fromUser,
              to: tx.p2pTransfer.toUser,
              direction: tx.p2pTransfer.fromUser.id === validFilters.userId ? 'outgoing' : 'incoming',
            },
          };
        } else if (tx.type === 'onramp' && tx.onrampTransaction) {
          return {
            ...base,
            details: {
              provider: tx.onrampTransaction.provider,
              payment_method: tx.onrampTransaction.payment_method,
            },
          };
        }
        
        return base;
      }),
      pagination: {
        total: totalCount,
        limit: validFilters.limit,
        offset: validFilters.offset,
      },
    };
  }
  
  async getTransactionById(id: number, userId: number) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        p2pTransfer: {
          select: {
            fromUser: {
              select: { id: true, name: true, number: true },
            },
            toUser: {
              select: { id: true, name: true, number: true },
            },
            timestamp: true,
          },
        },
        onrampTransaction: {
          select: {
            provider: true,
            payment_method: true,
            payment_details: true,
            startTime: true,
            status: true,
          },
        },
      },
    });
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    return transaction;
  }
  
  async getTransactionStats(userId: number) {
    // Get total sent and received in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stats = await prisma.$transaction([
      // Total sent (P2P)
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'p2p',
          timestamp: { gte: thirtyDaysAgo },
          status: 'completed',
          p2pTransfer: {
            fromUserId: userId,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      
      // Total received (P2P)
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'p2p',
          timestamp: { gte: thirtyDaysAgo },
          status: 'completed',
          p2pTransfer: {
            toUserId: userId,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      
      // Total added (OnRamp)
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'onramp',
          timestamp: { gte: thirtyDaysAgo },
          status: 'completed',
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    
    return {
      last30Days: {
        sent: {
          total: stats[0]._sum.amount || 0,
          count: stats[0]._count,
        },
        received: {
          total: stats[1]._sum.amount || 0,
          count: stats[1]._count,
        },
        added: {
          total: stats[2]._sum.amount || 0,
          count: stats[2]._count,
        },
      },
    };
  }
}

export const transactionService = new TransactionService();