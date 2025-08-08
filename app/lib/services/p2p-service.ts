"use server";

import { prisma } from '../prisma';
import { z } from 'zod';

// Input validation schema
const transferSchema = z.object({
  fromUserId: z.number(),
  toNumber: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
  amount: z.number().positive('Amount must be positive'),
});

export class P2PService {
  async transfer(fromUserId: number, toNumber: string, amount: number) {
    // Validate input
    const validData = transferSchema.parse({ fromUserId, toNumber, amount });
    
    return prisma.$transaction(async (tx) => {
      // Find recipient
      const recipient = await tx.user.findUnique({
        where: { number: validData.toNumber },
      });
      
      if (!recipient) {
        throw new Error('Recipient not found');
      }
      
      if (recipient.id === validData.fromUserId) {
        throw new Error('Cannot transfer to yourself');
      }
      
      // Lock rows for update
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${validData.fromUserId} FOR UPDATE`;
      await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${recipient.id} FOR UPDATE`;
      
      // Verify sender has sufficient balance
      const senderBalance = await tx.balance.findUnique({
        where: { userId: validData.fromUserId },
      });
      
      if (!senderBalance || senderBalance.amount < validData.amount) {
        throw new Error('Insufficient funds');
      }
      
      // Update balances
      await tx.balance.update({
        where: { userId: validData.fromUserId },
        data: { 
          amount: { decrement: validData.amount },
          updated_at: new Date(),
        },
      });
      
      await tx.balance.update({
        where: { userId: recipient.id },
        data: { 
          amount: { increment: validData.amount },
          updated_at: new Date(),
        },
      });
      
      // Create transfer record
      const transfer = await tx.p2pTransfer.create({
        data: {
          fromUserId: validData.fromUserId,
          toUserId: recipient.id,
          amount: validData.amount,
          timestamp: new Date(),
          status: 'completed',
        },
      });
      
      // Record in transaction ledger
      await tx.transaction.create({
        data: {
          type: 'p2p',
          amount: validData.amount,
          userId: validData.fromUserId,
          status: 'completed',
          reference_id: transfer.id,
          reference_type: 'p2pTransfer',
        },
      });
      
      return {
        id: transfer.id,
        amount: transfer.amount,
        timestamp: transfer.timestamp,
        recipient: {
          id: recipient.id,
          name: recipient.name,
          number: recipient.number,
        },
      };
    });
  }
  
  async getRecentContacts(userId: number, limit: number = 5) {
    // Find recent unique recipients
    const sentTransfers = await prisma.p2pTransfer.findMany({
      where: {
        fromUserId: userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 20, // Get more than needed to find unique recipients
      select: {
        toUser: {
          select: {
            id: true,
            name: true,
            number: true,
          },
        },
        timestamp: true,
      },
    });
    
    // Remove duplicates and limit
    const uniqueRecipients = Array.from(
      new Map(sentTransfers.map(item => [item.toUser.id, item])).values()
    ).slice(0, limit);
    
    return uniqueRecipients;
  }
}

export const p2pService = new P2PService();