/**
 * End-to-end tests for the transaction flow
 * These tests simulate complete user journeys through different transaction flows
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { OnRampTransaction } from '../../components/OnRampTransaction';
import { SendCard } from '../../components/SendCard';
import { createOnrampTransaction } from '../../app/lib/actions/createOnrampTransaction';
import { p2pTransfer } from '../../app/lib/actions/p2pTransfer';

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock transaction functions
jest.mock('../../app/lib/actions/createOnrampTransaction', () => ({
  createOnrampTransaction: jest.fn(),
}));

jest.mock('../../app/lib/actions/p2pTransfer', () => ({
  p2pTransfer: jest.fn(),
}));

describe('Transaction Flow End-to-End Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup authenticated session by default
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
        },
      },
      status: 'authenticated',
    });
  });
  
  describe('OnRamp Transaction Flow', () => {
    it('should render the onramp transaction form correctly', () => {
      render(<OnRampTransaction />);
      
      // Check for essential elements
      expect(screen.getByText(/add money/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add money/i })).toBeInTheDocument();
    });
    
    it('should process onramp transaction submission correctly', async () => {
      // Mock successful transaction creation
      (createOnrampTransaction as jest.Mock).mockResolvedValue({ success: true });
      
      render(<OnRampTransaction />);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText(/amount/i), {
        target: { value: '100' },
      });
      
      fireEvent.change(screen.getByLabelText(/provider/i), {
        target: { value: 'stripe' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /add money/i }));
      
      // Check if createOnrampTransaction was called with correct params
      await waitFor(() => {
        expect(createOnrampTransaction).toHaveBeenCalledWith({
          userId: '1',
          amount: 100,
          provider: 'stripe',
        });
      });
      
      // Check for success message
      await waitFor(() => {
        expect(screen.getByText(/transaction initiated successfully/i)).toBeInTheDocument();
      });
    });
    
    it('should display error on transaction failure', async () => {
      // Mock failed transaction
      (createOnrampTransaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));
      
      render(<OnRampTransaction />);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText(/amount/i), {
        target: { value: '100' },
      });
      
      fireEvent.change(screen.getByLabelText(/provider/i), {
        target: { value: 'stripe' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /add money/i }));
      
      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/transaction failed/i)).toBeInTheDocument();
      });
    });
    
    it('should validate amount input', async () => {
      render(<OnRampTransaction />);
      
      // Fill the form with invalid amount
      fireEvent.change(screen.getByLabelText(/amount/i), {
        target: { value: '-100' },  // Negative amount
      });
      
      fireEvent.change(screen.getByLabelText(/provider/i), {
        target: { value: 'stripe' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /add money/i }));
      
      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/amount must be positive/i)).toBeInTheDocument();
      });
      
      // createOnrampTransaction should not be called for invalid form
      expect(createOnrampTransaction).not.toHaveBeenCalled();
    });
  });
  
  describe('P2P Transfer Flow', () => {
    it('should render the P2P transfer form correctly', () => {
      render(<SendCard />);
      
      // Check for essential elements
      expect(screen.getByText(/send money/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });
    
    it('should process P2P transfer submission correctly', async () => {
      // Mock successful transfer
      (p2pTransfer as jest.Mock).mockResolvedValue({ success: true });
      
      render(<SendCard />);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText(/phone number/i), {
        target: { value: '9876543210' },
      });
      
      fireEvent.change(screen.getByLabelText(/amount/i), {
        target: { value: '50' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Check if p2pTransfer was called with correct params
      await waitFor(() => {
        expect(p2pTransfer).toHaveBeenCalledWith({
          fromUserId: '1',
          toUserPhone: '9876543210',
          amount: 50,
        });
      });
      
      // Check for success message
      await waitFor(() => {
        expect(screen.getByText(/money sent successfully/i)).toBeInTheDocument();
      });
    });
    
    it('should display error on transfer failure', async () => {
      // Mock failed transfer
      (p2pTransfer as jest.Mock).mockRejectedValue(new Error('Insufficient balance'));
      
      render(<SendCard />);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText(/phone number/i), {
        target: { value: '9876543210' },
      });
      
      fireEvent.change(screen.getByLabelText(/amount/i), {
        target: { value: '5000' },  // Amount exceeding balance
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      });
    });
    
    it('should handle non-existent recipient', async () => {
      // Mock recipient not found error
      (p2pTransfer as jest.Mock).mockRejectedValue(new Error('Recipient not found'));
      
      render(<SendCard />);
      
      // Fill the form with non-existent recipient
      fireEvent.change(screen.getByLabelText(/phone number/i), {
        target: { value: 'nonexistent' },
      });
      
      fireEvent.change(screen.getByLabelText(/amount/i), {
        target: { value: '50' },
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/recipient not found/i)).toBeInTheDocument();
      });
    });
    
    it('should validate amount input', async () => {
      render(<SendCard />);
      
      // Fill the form with invalid amount
      fireEvent.change(screen.getByLabelText(/phone number/i), {
        target: { value: '9876543210' },
      });
      
      fireEvent.change(screen.getByLabelText(/amount/i), {
        target: { value: '0' },  // Zero amount
      });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      
      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/amount must be positive/i)).toBeInTheDocument();
      });
      
      // p2pTransfer should not be called for invalid form
      expect(p2pTransfer).not.toHaveBeenCalled();
    });
  });
});