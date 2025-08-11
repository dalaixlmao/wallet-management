/**
 * Mock implementation for Prisma Client
 * Provides a consistent mock implementation for use in tests
 */

// Initialize mock data storage
const users = new Map([
  [1, {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    number: '1234567890',
    password: 'hashedPassword123',
  }],
  [2, {
    id: 2,
    email: 'recipient@example.com',
    name: 'Recipient User',
    number: '9876543210',
    password: 'hashedPassword456',
  }]
]);

const balances = new Map([
  [1, {
    id: 1,
    userId: 1,
    amount: 1000,
    locked: 0,
  }],
  [2, {
    id: 2,
    userId: 2,
    amount: 500,
    locked: 0,
  }]
]);

const transactions = [];
const transfers = [];

// Mock implementation
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(({ where }) => {
      if (where.id) {
        return Promise.resolve(users.get(where.id) || null);
      }
      if (where.email) {
        return Promise.resolve([...users.values()].find(u => u.email === where.email) || null);
      }
      if (where.number) {
        return Promise.resolve([...users.values()].find(u => u.number === where.number) || null);
      }
      return Promise.resolve(null);
    }),
    findFirst: jest.fn(({ where }) => {
      return Promise.resolve([...users.values()].find(u => {
        for (const key in where) {
          if (u[key] !== where[key]) return false;
        }
        return true;
      }) || null);
    }),
    create: jest.fn(({ data }) => {
      const id = users.size + 1;
      const newUser = { id, ...data };
      users.set(id, newUser);
      return Promise.resolve(newUser);
    }),
    update: jest.fn(({ where, data }) => {
      const user = users.get(where.id);
      if (!user) return Promise.resolve(null);
      const updatedUser = { ...user, ...data };
      users.set(where.id, updatedUser);
      return Promise.resolve(updatedUser);
    }),
  },
  balance: {
    findUnique: jest.fn(({ where }) => {
      if (where.userId) {
        return Promise.resolve(balances.get(where.userId) || null);
      }
      return Promise.resolve(null);
    }),
    update: jest.fn(({ where, data }) => {
      const balance = balances.get(where.userId);
      if (!balance) return Promise.resolve(null);
      const updatedBalance = { ...balance, ...data };
      balances.set(where.userId, updatedBalance);
      return Promise.resolve(updatedBalance);
    }),
    create: jest.fn(({ data }) => {
      const id = balances.size + 1;
      const userId = data.user?.connect?.id;
      const newBalance = { 
        id, 
        userId,
        amount: data.amount || 0,
        locked: data.locked || 0
      };
      balances.set(userId, newBalance);
      return Promise.resolve(newBalance);
    }),
  },
  onRampTransaction: {
    create: jest.fn(({ data }) => {
      const id = transactions.length + 1;
      const userId = data.user?.connect?.id;
      const transaction = {
        id,
        userId,
        amount: data.amount,
        provider: data.provider,
        status: data.status || 'Processing',
        token: data.token || `token-${Date.now()}`,
        startTime: data.startTime || new Date(),
      };
      transactions.push(transaction);
      return Promise.resolve(transaction);
    }),
    findUnique: jest.fn(({ where }) => {
      if (where.id) {
        return Promise.resolve(transactions.find(t => t.id === where.id) || null);
      }
      if (where.token) {
        return Promise.resolve(transactions.find(t => t.token === where.token) || null);
      }
      return Promise.resolve(null);
    }),
    update: jest.fn(({ where, data }) => {
      const index = transactions.findIndex(t => t.id === where.id);
      if (index === -1) return Promise.resolve(null);
      
      transactions[index] = { ...transactions[index], ...data };
      return Promise.resolve(transactions[index]);
    }),
  },
  p2pTransfer: {
    create: jest.fn(({ data }) => {
      const id = transfers.length + 1;
      const transfer = {
        id,
        fromUserId: data.fromUser?.connect?.id,
        toUserId: data.toUser?.connect?.id,
        amount: data.amount,
        timestamp: data.timestamp || new Date(),
      };
      transfers.push(transfer);
      return Promise.resolve(transfer);
    }),
    findMany: jest.fn(({ where }) => {
      let results = [...transfers];
      
      if (where) {
        if (where.fromUserId) {
          results = results.filter(t => t.fromUserId === where.fromUserId);
        }
        if (where.toUserId) {
          results = results.filter(t => t.toUserId === where.toUserId);
        }
      }
      
      return Promise.resolve(results);
    }),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaClient)),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

// Export the mock client
export const PrismaClient = jest.fn(() => mockPrismaClient);

// Export mock data for test manipulation
export const mockData = {
  users,
  balances,
  transactions,
  transfers,
  reset: () => {
    users.clear();
    balances.clear();
    transactions.length = 0;
    transfers.length = 0;
    
    // Add default test data
    users.set(1, {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      number: '1234567890',
      password: 'hashedPassword123',
    });
    
    users.set(2, {
      id: 2,
      email: 'recipient@example.com',
      name: 'Recipient User',
      number: '9876543210',
      password: 'hashedPassword456',
    });
    
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
  }
};