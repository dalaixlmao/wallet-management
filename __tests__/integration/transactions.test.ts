import { PrismaClient } from '@prisma/client';
import { createOnrampTransaction } from '../../app/lib/actions/createOnrampTransaction';
import { p2pTransfer } from '../../app/lib/actions/p2pTransfer';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    onRampTransaction: {
      create: jest.fn(),
    },
    balance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    p2pTransfer: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaClient)),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  
  return { 
    PrismaClient: jest.fn(() => mockPrismaClient),
    OnRampStatus: {
      Processing: 'Processing',
      Success: 'Success',
      Failure: 'Failure'
    }
  };
});

describe('Transaction System Integration Tests', () => {
  let prisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
  });
  
  describe('OnRamp Transaction Processing', () => {
    it('should create a new onramp transaction', async () => {
      // Setup mocks
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        name: 'Test User',
      });
      
      prisma.onRampTransaction.create.mockResolvedValue({
        id: 1,
        userId: 1,
        amount: 100,
        status: 'Processing',
        token: 'test-token',
        provider: 'test-provider',
        startTime: new Date(),
      });
      
      // Call function
      const result = await createOnrampTransaction({
        userId: '1',
        amount: 100,
        provider: 'test-provider',
      });
      
      // Assertions
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(prisma.onRampTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 100,
          provider: 'test-provider',
          status: 'Processing',
          user: {
            connect: {
              id: 1,
            },
          },
        }),
      });
      expect(result).toBeTruthy();
    });
    
    it('should handle missing user error', async () => {
      // Setup mocks - user not found
      prisma.user.findUnique.mockResolvedValue(null);
      
      // Call function and expect it to throw
      await expect(
        createOnrampTransaction({
          userId: 'nonexistent',
          amount: 100,
          provider: 'test-provider',
        })
      ).rejects.toThrow();
      
      // Verify that transaction was not created
      expect(prisma.onRampTransaction.create).not.toHaveBeenCalled();
    });
  });
  
  describe('P2P Transfer Processing', () => {
    it('should process a valid P2P transfer between users', async () => {
      // Setup sender
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'Sender',
        email: 'sender@example.com',
        number: '1234567890',
      });
      
      // Setup recipient
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Recipient',
        email: 'recipient@example.com',
        number: '9876543210',
      });
      
      // Setup sender balance
      prisma.balance.findUnique.mockResolvedValueOnce({
        id: 1,
        userId: 1,
        amount: 1000,
        locked: 0,
      });
      
      // Setup recipient balance
      prisma.balance.findUnique.mockResolvedValueOnce({
        id: 2,
        userId: 2,
        amount: 500,
        locked: 0,
      });
      
      // Mock balance updates
      prisma.balance.update.mockResolvedValueOnce({
        id: 1,
        userId: 1,
        amount: 900, // 1000 - 100
        locked: 0,
      });
      
      prisma.balance.update.mockResolvedValueOnce({
        id: 2,
        userId: 2,
        amount: 600, // 500 + 100
        locked: 0,
      });
      
      // Mock P2P transfer creation
      prisma.p2pTransfer.create.mockResolvedValue({
        id: 1,
        fromUserId: 1,
        toUserId: 2,
        amount: 100,
        timestamp: expect.any(Date),
      });
      
      // Call P2P transfer function
      const result = await p2pTransfer({
        fromUserId: '1',
        toUserPhone: '9876543210',
        amount: 100,
      });
      
      // Assertions
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { number: '9876543210' },
      });
      expect(prisma.balance.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.balance.update).toHaveBeenCalledTimes(2);
      expect(prisma.p2pTransfer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 100,
          fromUser: {
            connect: {
              id: 1,
            },
          },
          toUser: {
            connect: {
              id: 2,
            },
          },
          timestamp: expect.any(Date),
        }),
      });
      expect(result).toBeTruthy();
    });
    
    it('should handle insufficient funds for P2P transfer', async () => {
      // Setup sender
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'Sender',
        email: 'sender@example.com',
        number: '1234567890',
      });
      
      // Setup recipient
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Recipient',
        email: 'recipient@example.com',
        number: '9876543210',
      });
      
      // Setup sender balance with insufficient funds
      prisma.balance.findUnique.mockResolvedValueOnce({
        id: 1,
        userId: 1,
        amount: 50,  // Less than transfer amount (100)
        locked: 0,
      });
      
      // Call P2P transfer function and expect it to throw
      await expect(
        p2pTransfer({
          fromUserId: '1',
          toUserPhone: '9876543210',
          amount: 100,
        })
      ).rejects.toThrow('Insufficient balance');
      
      // Verify that no updates were performed
      expect(prisma.balance.update).not.toHaveBeenCalled();
      expect(prisma.p2pTransfer.create).not.toHaveBeenCalled();
    });
    
    it('should handle invalid recipient phone number', async () => {
      // Setup sender
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'Sender',
        email: 'sender@example.com',
        number: '1234567890',
      });
      
      // Setup non-existent recipient
      prisma.user.findUnique.mockResolvedValueOnce(null);
      
      // Call P2P transfer function and expect it to throw
      await expect(
        p2pTransfer({
          fromUserId: '1',
          toUserPhone: 'nonexistent',
          amount: 100,
        })
      ).rejects.toThrow('Recipient not found');
      
      // Verify that no balance checks or updates were performed
      expect(prisma.balance.findUnique).not.toHaveBeenCalled();
      expect(prisma.balance.update).not.toHaveBeenCalled();
      expect(prisma.p2pTransfer.create).not.toHaveBeenCalled();
    });
  });
});