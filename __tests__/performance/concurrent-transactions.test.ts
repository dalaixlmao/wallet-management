/**
 * Performance tests for concurrent transaction processing
 */
import { PrismaClient } from '@prisma/client';
import { p2pTransfer } from '../../app/lib/actions/p2pTransfer';

// Mock Prisma
jest.mock('@prisma/client', () => {
  // Create a realistic mock that can track transaction conflicts
  let balances = new Map();
  let lastTransactionId = 0;
  
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn().mockImplementation((args) => {
        if (args.where.id === 1) {
          return Promise.resolve({
            id: 1,
            name: 'Sender',
            email: 'sender@example.com',
            number: '1234567890',
          });
        } else if (args.where.id === 2) {
          return Promise.resolve({
            id: 2,
            name: 'Recipient',
            email: 'recipient@example.com',
            number: '9876543210',
          });
        } else if (args.where.number === '9876543210') {
          return Promise.resolve({
            id: 2,
            name: 'Recipient',
            email: 'recipient@example.com',
            number: '9876543210',
          });
        }
        return Promise.resolve(null);
      }),
    },
    balance: {
      findUnique: jest.fn().mockImplementation((args) => {
        const userId = args.where.userId;
        return Promise.resolve(balances.get(userId));
      }),
      update: jest.fn().mockImplementation((args) => {
        const userId = args.where.userId;
        const currentBalance = balances.get(userId);
        const newBalance = {
          ...currentBalance,
          ...args.data,
        };
        balances.set(userId, newBalance);
        return Promise.resolve(newBalance);
      }),
    },
    p2pTransfer: {
      create: jest.fn().mockImplementation((args) => {
        lastTransactionId += 1;
        return Promise.resolve({
          id: lastTransactionId,
          fromUserId: args.data.fromUser.connect.id,
          toUserId: args.data.toUser.connect.id,
          amount: args.data.amount,
          timestamp: args.data.timestamp,
        });
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      return callback(mockPrismaClient);
    }),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  
  return { 
    PrismaClient: jest.fn(() => mockPrismaClient) 
  };
});

describe('Concurrent Transaction Performance Tests', () => {
  let prisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    
    // Reset the balance Map and initialize test data
    require('@prisma/client').__balances = new Map();
    const balances = new Map();
    
    // Set initial balances
    balances.set(1, {
      id: 1,
      userId: 1,
      amount: 1000,
      locked: 0,
    });
    
    balances.set(2, {
      id: 2,
      userId: 2,
      amount: 500,
      locked: 0,
    });
    
    // Attach to the module export for the mock implementation to access
    require('@prisma/client').__balances = balances;
  });
  
  describe('Concurrent P2P Transfers', () => {
    it('should handle multiple concurrent transfers correctly', async () => {
      // Create multiple transfer requests
      const transferPromises = [];
      for (let i = 0; i < 10; i++) {
        transferPromises.push(
          p2pTransfer({
            fromUserId: '1',
            toUserPhone: '9876543210',
            amount: 50, // 10 transfers of 50 each = 500 total
          })
        );
      }
      
      // Execute all transfers concurrently
      await Promise.all(transferPromises);
      
      // Check final balances
      const senderBalance = await prisma.balance.findUnique({
        where: { userId: 1 },
      });
      
      const recipientBalance = await prisma.balance.findUnique({
        where: { userId: 2 },
      });
      
      // Verify the final state
      expect(senderBalance.amount).toBe(500); // 1000 - (50 * 10)
      expect(recipientBalance.amount).toBe(1000); // 500 + (50 * 10)
      expect(prisma.p2pTransfer.create).toHaveBeenCalledTimes(10);
    });
    
    it('should handle race conditions with optimistic concurrency control', async () => {
      // Mock a more realistic transaction with version-based concurrency control
      prisma.$transaction.mockImplementation(async (callback) => {
        // Simulate random delay to increase chance of race condition
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return callback(prisma);
      });
      
      // Create multiple transfer requests
      const transferPromises = [];
      for (let i = 0; i < 5; i++) {
        transferPromises.push(
          p2pTransfer({
            fromUserId: '1',
            toUserPhone: '9876543210',
            amount: 100, // 5 transfers of 100 each = 500 total
          })
        );
      }
      
      // Execute all transfers concurrently
      await Promise.all(transferPromises);
      
      // Check final balances
      const senderBalance = await prisma.balance.findUnique({
        where: { userId: 1 },
      });
      
      const recipientBalance = await prisma.balance.findUnique({
        where: { userId: 2 },
      });
      
      // Verify the final state
      expect(senderBalance.amount).toBe(500); // 1000 - (100 * 5)
      expect(recipientBalance.amount).toBe(1000); // 500 + (100 * 5)
      expect(prisma.p2pTransfer.create).toHaveBeenCalledTimes(5);
    });
    
    it('should prevent overdrafts under concurrent load', async () => {
      // Set initial balance lower for this test
      const balances = require('@prisma/client').__balances;
      balances.set(1, {
        id: 1,
        userId: 1,
        amount: 300, // Only enough for 3 transfers
        locked: 0,
      });
      
      // Mock to track completed transfers
      const successfulTransfers = [];
      const failedTransfers = [];
      
      prisma.p2pTransfer.create.mockImplementation((args) => {
        lastTransactionId += 1;
        successfulTransfers.push({
          id: lastTransactionId,
          fromUserId: args.data.fromUser.connect.id,
          toUserId: args.data.toUser.connect.id,
          amount: args.data.amount,
        });
        return Promise.resolve({
          id: lastTransactionId,
          fromUserId: args.data.fromUser.connect.id,
          toUserId: args.data.toUser.connect.id,
          amount: args.data.amount,
          timestamp: args.data.timestamp,
        });
      });
      
      // Create multiple transfer requests
      const transferPromises = [];
      for (let i = 0; i < 5; i++) {
        transferPromises.push(
          p2pTransfer({
            fromUserId: '1',
            toUserPhone: '9876543210',
            amount: 100,
          }).catch(error => {
            failedTransfers.push({
              error: error.message,
              amount: 100
            });
            return null; // Prevent the promise from rejecting
          })
        );
      }
      
      // Execute all transfers concurrently
      await Promise.all(transferPromises);
      
      // Check final balances
      const senderBalance = await prisma.balance.findUnique({
        where: { userId: 1 },
      });
      
      const recipientBalance = await prisma.balance.findUnique({
        where: { userId: 2 },
      });
      
      // Verify exactly 3 transfers succeeded (300/100 = 3)
      expect(successfulTransfers.length).toBe(3);
      expect(failedTransfers.length).toBe(2); // 2 transfers should fail
      
      // Verify correct final balances
      expect(senderBalance.amount).toBe(0); // 300 - (100 * 3)
      expect(recipientBalance.amount).toBe(800); // 500 + (100 * 3)
    });
  });
  
  describe('System Under Load', () => {
    it('should maintain data consistency under high concurrency', async () => {
      // Set initial balances higher for this stress test
      const balances = require('@prisma/client').__balances;
      balances.set(1, {
        id: 1,
        userId: 1,
        amount: 10000,
        locked: 0,
      });
      
      // Track total amount transferred
      let totalTransferred = 0;
      
      // Create a large number of concurrent small transfers
      const transferPromises = [];
      for (let i = 0; i < 100; i++) {
        const amount = Math.floor(Math.random() * 20) + 10; // Random amount between 10-30
        totalTransferred += amount;
        
        transferPromises.push(
          p2pTransfer({
            fromUserId: '1',
            toUserPhone: '9876543210',
            amount,
          })
        );
      }
      
      // Execute all transfers concurrently
      await Promise.all(transferPromises);
      
      // Check final balances
      const senderBalance = await prisma.balance.findUnique({
        where: { userId: 1 },
      });
      
      const recipientBalance = await prisma.balance.findUnique({
        where: { userId: 2 },
      });
      
      // Verify correct final balances
      expect(senderBalance.amount).toBe(10000 - totalTransferred);
      expect(recipientBalance.amount).toBe(500 + totalTransferred);
      expect(prisma.p2pTransfer.create).toHaveBeenCalledTimes(100);
    });
  });
});