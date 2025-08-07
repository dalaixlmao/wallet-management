// jest.setup.js
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock NextAuth
jest.mock('next-auth/react', () => {
  const originalModule = jest.requireActual('next-auth/react');
  return {
    __esModule: true,
    ...originalModule,
    signIn: jest.fn(),
    signOut: jest.fn(),
    useSession: jest.fn(() => {
      return { data: null, status: 'unauthenticated' };
    }),
  };
});

// Mock getServerSession for API route testing
jest.mock('next-auth', () => {
  const originalModule = jest.requireActual('next-auth');
  return {
    __esModule: true,
    ...originalModule,
    getServerSession: jest.fn(() => {
      return { user: { id: '1', name: 'Test User' } };
    }),
  };
});

// Required for Next.js 13/14 App Router testing
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Silence console errors during tests
console.error = jest.fn();

// Mock fetch
global.fetch = jest.fn();