/**
 * End-to-end tests for the authentication flow
 * These tests simulate a complete user journey through the authentication process
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { signIn } from 'next-auth/react';
import SignInPage from '../../app/signin/page';
import SignUpPage from '../../app/signup/page';

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
}));

// Mock Next Router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
}));

describe('Authentication End-to-End Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Login Flow', () => {
    it('should render the login page correctly', async () => {
      render(<SignInPage />);
      
      // Check for essential elements
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
    
    it('should handle form submission correctly', async () => {
      // Mock successful login
      (signIn as jest.Mock).mockResolvedValue({ ok: true, error: null });
      
      render(<SignInPage />);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: '1234567890' },
      });
      
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'secure_password' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      // Check if signIn was called with correct params
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('credentials', {
          number: '1234567890',
          password: 'secure_password',
          redirect: false,
        });
      });
    });
    
    it('should display error on failed login', async () => {
      // Mock failed login
      (signIn as jest.Mock).mockResolvedValue({
        ok: false,
        error: 'Invalid credentials',
      });
      
      render(<SignInPage />);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: '1234567890' },
      });
      
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'wrong_password' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      // Check if error is displayed
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
    
    it('should handle form validation', async () => {
      render(<SignInPage />);
      
      // Submit empty form
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/phone is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
      
      // signIn should not be called for invalid form
      expect(signIn).not.toHaveBeenCalled();
    });
  });
  
  describe('Registration Flow', () => {
    it('should render the signup page correctly', async () => {
      render(<SignUpPage />);
      
      // Check for essential elements
      expect(screen.getByText(/create account/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });
    
    it('should handle registration form submission', async () => {
      // Mock successful registration
      (signIn as jest.Mock).mockResolvedValue({ ok: true });
      
      render(<SignUpPage />);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Test User' },
      });
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: '1234567890' },
      });
      
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'secure_password' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
      
      // Check if signIn was called with correct params
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('credentials', {
          name: 'Test User',
          email: 'test@example.com',
          phone: '1234567890',
          password: 'secure_password',
          redirect: false,
        });
      });
    });
    
    it('should validate email format', async () => {
      render(<SignUpPage />);
      
      // Fill the form with invalid email
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Test User' },
      });
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid-email' },
      });
      
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: '1234567890' },
      });
      
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'secure_password' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
      
      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
      
      // signIn should not be called for invalid form
      expect(signIn).not.toHaveBeenCalled();
    });
    
    it('should validate password strength', async () => {
      render(<SignUpPage />);
      
      // Fill the form with weak password
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Test User' },
      });
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: '1234567890' },
      });
      
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'weak' },  // Too short
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
      
      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
      
      // signIn should not be called for invalid form
      expect(signIn).not.toHaveBeenCalled();
    });
  });
});