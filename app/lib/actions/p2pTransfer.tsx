"use server"
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import { PrismaClient } from "@prisma/client";

// Create a singleton instance of PrismaClient
let prisma: any;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Prevent multiple instances during development/testing
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

interface P2PTransferParams {
  fromUserId?: string;
  toUserPhone: string;
  amount: number;
}

export async function p2pTransfer({ fromUserId, toUserPhone, amount }: P2PTransferParams) {
    // Get user ID from session if not explicitly provided (for testing)
    let from = fromUserId;
    
    if (!from) {
        const session = await getServerSession(authOptions);
        from = session?.user?.id;
        
        if (!from) {
            throw new Error("Unauthorized: User not authenticated");
        }
    }
    
    // Find recipient user by phone number
    const toUser = await prisma.user.findFirst({
        where: {
            number: toUserPhone
        }
    });
    
    if (!toUser) {
        throw new Error("Recipient not found");
    }

    // Prevent sending money to self
    if(Number(from) === toUser.id) {
        throw new Error("Cannot send money to yourself");
    }

    // Execute transaction with proper locking and error handling
    try {
        return await prisma.$transaction(async (tx:any) => {
            // Lock sender's balance record for update to prevent race conditions
            await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${Number(from)} FOR UPDATE`;

            // Check sender's balance
            const fromBalance = await tx.balance.findUnique({
                where: { userId: Number(from) },
            });
            
            if (!fromBalance || fromBalance.amount < amount) {
                throw new Error('Insufficient funds');
            }

            // Check recipient's balance
            const toUserBalance = await tx.balance.findUnique({
                where: { userId: toUser.id },
            });
            
            if (!toUserBalance) {
                throw new Error('Recipient balance record not found');
            }

            // Update sender's balance (deduct amount)
            await tx.balance.update({
                where: { userId: Number(from) },
                data: { amount: { decrement: amount } },
            });
            
            // Update recipient's balance (add amount)
            await tx.balance.update({
                where: { userId: toUser.id },
                data: { amount: { increment: amount } },
            });

            // Create transfer record
            const transfer = await tx.p2pTransfer.create({
                data: {
                    fromUserId: Number(from),
                    toUserId: toUser.id,
                    amount,
                    timestamp: new Date()
                }
            });
            
            return {
                success: true,
                transferId: transfer.id,
                amount: amount,
                recipient: toUser.name,
                timestamp: transfer.timestamp
            };
        });
    } catch (error: any) {
        // Handle and rethrow with better context
        throw new Error(`Transfer failed: ${error.message}`);
    }
}