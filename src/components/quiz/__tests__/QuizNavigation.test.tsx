import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, beforeEach } from '@jest/globals';
import QuizNavigation from '../QuizNavigation';

describe('QuizNavigation', () => {
  const defaultProps = {
    onBack: jest.fn(),
    onNext: jest.fn(),
    canGoBack: true,
    canGoNext: true,
    isLastQuestion: false,
    currentQuestion: 5,
    totalQuestions: 14,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders back and next buttons', () => {
    render(<QuizNavigation {...defaultProps} />);

    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    
    render(<QuizNavigation {...defaultProps} onBack={onBack} />);
    
    await user.click(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when next button is clicked', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();
    
    render(<QuizNavigation {...defaultProps} onNext={onNext} />);
    
    await user.click(screen.getByText('Next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables back button when canGoBack is false', () => {
    render(<QuizNavigation {...defaultProps} canGoBack={false} />);

    const backButton = screen.getByText('Back').closest('button');
    expect(backButton).toBeDisabled();
  });

  it('disables next button when canGoNext is false', () => {
    render(<QuizNavigation {...defaultProps} canGoNext={false} />);

    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('shows "See Results" on last question', () => {
    render(<QuizNavigation {...defaultProps} isLastQuestion={true} />);

    expect(screen.getByText('See Results')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });
});

