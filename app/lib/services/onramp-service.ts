"use server";

import { prisma } from '../prisma';
import { z } from 'zod';

// Input validation schema
const onrampSchema = z.object({
  userId: z.number(),
  provider: z.string(),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().optional(),
});

const completeSchema = z.object({
  token: z.string(),
  success: z.boolean(),
});

export class OnRampService {
  async createOnRampTransaction(
    userId: number, 
    provider: string, 
    amount: number, 
    paymentMethod?: string
  ) {
    // Validate input
    const validData = onrampSchema.parse({ userId, provider, amount, paymentMethod });
    
    // Generate unique token
    const token = `onramp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    return prisma.$transaction(async (tx) => {
      // Create initial pending transaction
      const onramp = await tx.onRampTransaction.create({
        data: {
          userId: validData.userId,
          provider: validData.provider,
          amount: validData.amount,
          token,
          status: 'Processing',
          startTime: new Date(),
          payment_method: validData.paymentMethod,
          payment_details: {
            initiated_at: new Date().toISOString(),
          },
        },
      });
      
      // Create transaction record
      await tx.transaction.create({
        data: {
          type: 'onramp',
          amount: validData.amount,
          userId: validData.userId,
          status: 'processing',
          reference_id: onramp.id,
          reference_type: 'OnRampTransaction',
        },
      });
      
      return {
        id: onramp.id,
        token,
        amount: onramp.amount,
        provider: onramp.provider,
        status: 'Processing',
        startTime: onramp.startTime,
      };
    });
  }
  
  async completeOnRampTransaction(token: string, success: boolean) {
    // Validate input
    const validData = completeSchema.parse({ token, success });
    
    return prisma.$transaction(async (tx) => {
      // Find the pending transaction
      const onramp = await tx.onRampTransaction.findUnique({
        where: { token: validData.token },
      });
      
      if (!onramp) {
        throw new Error('Transaction not found');
      }
      
      if (onramp.status !== 'Processing') {
        throw new Error('Transaction already processed');
      }
      
      // Update onramp status
      const status = validData.success ? 'Success' : 'Failure';
      const updatedOnramp = await tx.onRampTransaction.update({
        where: { id: onramp.id },
        data: {
          status,
          payment_details: {
            ...(onramp.payment_details as any || {}),
            completed_at: new Date().toISOString(),
            success: validData.success,
          },
        },
      });
      
      // Update transaction record
      await tx.transaction.updateMany({
        where: {
          reference_id: onramp.id,
          reference_type: 'OnRampTransaction',
        },
        data: {
          status: validData.success ? 'completed' : 'failed',
        },
      });
      
      // If successful, update user balance
      if (validData.success) {
        // Lock the balance row
        await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${onramp.userId} FOR UPDATE`;
        
        // Get current balance
        const balance = await tx.balance.findUnique({
          where: { userId: onramp.userId },
        });
        
        if (!balance) {
          // Create balance if it doesn't exist
          await tx.balance.create({
            data: {
              userId: onramp.userId,
              amount: onramp.amount,
              locked: 0,
            },
          });
        } else {
          // Update existing balance
          await tx.balance.update({
            where: { userId: onramp.userId },
            data: {
              amount: { increment: onramp.amount },
              updated_at: new Date(),
            },
          });
        }
      }
      
      return {
        id: updatedOnramp.id,
        status,
        success: validData.success,
        amount: updatedOnramp.amount,
        provider: updatedOnramp.provider,
        userId: updatedOnramp.userId,
      };
    });
  }
  
  async getOnRampTransactionByToken(token: string) {
    return prisma.onRampTransaction.findUnique({
      where: { token },
    });
  }
  
  async getOnRampTransactionsByUser(userId: number) {
    return prisma.onRampTransaction.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
    });
  }
}

export const onRampService = new OnRampService();