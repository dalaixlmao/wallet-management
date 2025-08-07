import { hash, compare } from 'bcrypt';
import { authOptions } from '../../app/lib/auth';
import { PrismaClient } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation(() => Promise.resolve('hashed_password')),
  compare: jest.fn().mockImplementation(() => Promise.resolve(true)),
}));

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    balance: {
      create: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  
  return { 
    PrismaClient: jest.fn(() => mockPrismaClient) 
  };
});

describe('Auth System Unit Tests', () => {
  let prisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
  });

  describe('User Authentication', () => {
    it('should successfully authenticate a user with correct credentials', async () => {
      // Setup mocks
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        number: '1234567890',
        password: 'hashed_password',
      });
      
      // Create credentials object
      const credentials = {
        number: '1234567890',
        password: 'correct_password'
      };
      
      // Call authorize function
      const result = await authOptions.providers[0].authorize(credentials);
      
      // Assertions
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { number: '1234567890' },
      });
      expect(compare).toHaveBeenCalledWith('correct_password', 'hashed_password');
      expect(result).toEqual({ id: '1' });
    });

    it('should reject authentication with incorrect credentials', async () => {
      // Setup mocks
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        number: '1234567890',
        password: 'hashed_password',
      });
      
      // Make compare return false for incorrect password
      (compare as jest.Mock).mockResolvedValueOnce(false);
      
      // Create credentials object
      const credentials = {
        number: '1234567890',
        password: 'wrong_password'
      };
      
      // Call authorize function
      const result = await authOptions.providers[0].authorize(credentials);
      
      // Assertions
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { number: '1234567890' },
      });
      expect(compare).toHaveBeenCalledWith('wrong_password', 'hashed_password');
      expect(result).toBeNull();
    });

    it('should reject authentication for non-existent user', async () => {
      // Setup mocks - user not found
      prisma.user.findUnique.mockResolvedValue(null);
      
      // Create credentials object
      const credentials = {
        number: 'nonexistent',
        password: 'any_password'
      };
      
      // Call authorize function
      const result = await authOptions.providers[0].authorize(credentials);
      
      // Assertions
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { number: 'nonexistent' },
      });
      // Compare should not be called if user doesn't exist
      expect(compare).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should successfully register a new user', async () => {
      // Setup mocks
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 1,
        email: 'new@example.com',
        name: 'New User',
        number: '9876543210',
        password: 'hashed_password',
      });
      prisma.balance.create.mockResolvedValue({
        id: 1,
        userId: 1,
        amount: 1000,
        locked: 0
      });
      
      // Create credentials object with name field to trigger registration
      const credentials = {
        name: 'New User',
        email: 'new@example.com',
        password: 'secure_password',
        phone: '9876543210'
      };
      
      // Call authorize function
      const result = await authOptions.providers[0].authorize(credentials);
      
      // Assertions
      expect(hash).toHaveBeenCalledWith('secure_password', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'New User',
          email: 'new@example.com',
          number: '9876543210',
          password: 'hashed_password',
        },
      });
      expect(prisma.balance.create).toHaveBeenCalled();
      expect(result).toEqual({ id: '1' });
    });
    
    it('should handle validation errors in credentials', async () => {
      // Create invalid credentials object
      const credentials = {
        number: '',  // Empty number - should fail validation
        password: 'pwd'  // Too short - should fail validation
      };
      
      // Call authorize function
      const result = await authOptions.providers[0].authorize(credentials);
      
      // Assertions
      expect(result).toBeNull();
      // Prisma should not be called if validation fails
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Session Handling', () => {
    it('should add user ID to session from token', async () => {
      // Setup mock session and token
      const mockSession = {
        user: {}
      };
      const mockToken = {
        sub: '123'
      };
      
      // Call session callback
      const result = await authOptions.callbacks.session({ token: mockToken, session: mockSession });
      
      // Assertions
      expect(result.user.id).toBe('123');
    });
  });
});