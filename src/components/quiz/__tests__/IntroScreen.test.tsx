import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import IntroScreen from '../IntroScreen';

describe('IntroScreen', () => {
  const mockOnStart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the intro screen with form', () => {
    render(<IntroScreen onStart={mockOnStart} />);

    expect(screen.getByText('Discover Your Voice Archetype')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    render(<IntroScreen onStart={mockOnStart} />);

    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Phone number is required')).toBeInTheDocument();
    });

    expect(mockOnStart).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<IntroScreen onStart={mockOnStart} />);

    // Fill all required fields
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    const emailInput = screen.getByLabelText(/Email Address/i);
    // Type invalid email (has @ but no dot after it - fails regex but might pass browser validation)
    await user.type(emailInput, 'test@invalid');
    await user.type(screen.getByLabelText(/Phone Number/i), '9876543210');
    
    // Select occupation
    const occupationButton = screen.getByRole('combobox', { name: /Occupation/i });
    await user.click(occupationButton);
    await user.click(screen.getByRole('option', { name: 'Working Professional' }));
    
    // Select age group
    const ageGroupButton = screen.getByRole('combobox', { name: /Age Group/i });
    await user.click(ageGroupButton);
    await user.click(screen.getByRole('option', { name: '25-34' }));
    
    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('validates Indian phone number format', async () => {
    const user = userEvent.setup();
    render(<IntroScreen onStart={mockOnStart} />);

    const phoneInput = screen.getByLabelText(/Phone Number/i);
    await user.type(phoneInput, '1234567890'); // Invalid (doesn't start with 6-9)
    
    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/valid 10-digit Indian phone number/i)).toBeInTheDocument();
    });
  });

  it('accepts valid phone number starting with 6-9', async () => {
    const user = userEvent.setup();
    render(<IntroScreen onStart={mockOnStart} />);

    const phoneInput = screen.getByLabelText(/Phone Number/i);
    await user.type(phoneInput, '9876543210');
    
    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    await user.click(submitButton);

    // Should not show phone error for valid number
    await waitFor(() => {
      expect(screen.queryByText(/valid 10-digit Indian phone number/i)).not.toBeInTheDocument();
    });
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<IntroScreen onStart={mockOnStart} />);

    const nameInput = screen.getByLabelText(/Full Name/i);
    
    // Submit to trigger error
    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    // Start typing to clear error
    await user.type(nameInput, 'John');
    
    await waitFor(() => {
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    });
  });

  it('calls onStart with form data when form is valid', async () => {
    const user = userEvent.setup();
    render(<IntroScreen onStart={mockOnStart} />);

    // Fill in all required fields
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email Address/i), 'john@example.com');
    await user.type(screen.getByLabelText(/Phone Number/i), '9876543210');
    
    // Select occupation using the combobox
    const occupationButton = screen.getByRole('combobox', { name: /Occupation/i });
    await user.click(occupationButton);
    const occupationOption = screen.getByRole('option', { name: 'Working Professional' });
    await user.click(occupationOption);
    
    // Select age group
    const ageGroupButton = screen.getByRole('combobox', { name: /Age Group/i });
    await user.click(ageGroupButton);
    const ageGroupOption = screen.getByRole('option', { name: '25-34' });
    await user.click(ageGroupOption);

    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnStart).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        occupation: 'Working Professional',
        ageGroup: '25-34',
      });
    });
  });

  it('disables form when isStarting is true', () => {
    render(<IntroScreen onStart={mockOnStart} isStarting={true} />);

    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByLabelText(/Full Name/i)).toBeDisabled();
  });

  it('displays startError when provided', () => {
    const errorMessage = 'Network error occurred';
    render(<IntroScreen onStart={mockOnStart} startError={errorMessage} />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('prevents double submission when isStarting is true', async () => {
    const user = userEvent.setup();
    render(<IntroScreen onStart={mockOnStart} isStarting={true} />);

    const submitButton = screen.getByRole('button', { name: /Start the voice archetype quiz/i });
    await user.click(submitButton);

    // Should not call onStart when already starting
    expect(mockOnStart).not.toHaveBeenCalled();
  });
});

