import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { GET } from '../../app/api/user/route';

// Mock Next.js modules
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body, options) => ({ 
      body, 
      options,
      headers: new Map()
    }))
  },
  NextRequest: jest.fn()
}));

// Mock getServerSession
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

describe('User API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/user', () => {
    it('should return user data when authenticated', async () => {
      // Setup mock session
      const mockSession = {
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com'
        }
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      
      // Call API handler
      const response = await GET();
      
      // Assertions
      expect(getServerSession).toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith({
        user: mockSession.user
      });
      expect(response.body).toEqual({ 
        user: mockSession.user 
      });
    });

    it('should return 403 when not authenticated', async () => {
      // Setup mock session (null for unauthenticated user)
      (getServerSession as jest.Mock).mockResolvedValue(null);
      
      // Call API handler
      const response = await GET();
      
      // Assertions
      expect(getServerSession).toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          message: 'You are not logged in',
        },
        {
          status: 403,
        }
      );
      expect(response.options.status).toBe(403);
    });

    it('should handle errors and return 403', async () => {
      // Setup mock session to throw error
      (getServerSession as jest.Mock).mockRejectedValue(new Error('Auth error'));
      
      // Call API handler
      const response = await GET();
      
      // Assertions
      expect(getServerSession).toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          message: 'You are not logged in',
        },
        {
          status: 403,
        }
      );
      expect(response.options.status).toBe(403);
    });
  });
});