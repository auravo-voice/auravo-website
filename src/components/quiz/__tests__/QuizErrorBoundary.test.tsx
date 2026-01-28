import React from 'react';
import { render, screen } from '@testing-library/react';
import { jest, beforeAll, afterAll } from '@jest/globals';
import QuizErrorBoundary from '../QuizErrorBoundary';

// Mock console.error to avoid noise in test output
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('QuizErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <QuizErrorBoundary>
        <div>Test content</div>
      </QuizErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <QuizErrorBoundary>
        <ThrowError shouldThrow={true} />
      </QuizErrorBoundary>
    );

    expect(screen.getByText('Quiz under maintenance')).toBeInTheDocument();
    expect(screen.getByText(/The quiz is currently under maintenance/)).toBeInTheDocument();
    expect(screen.getByText('Go back to homepage')).toBeInTheDocument();
  });

  it('renders children when error is not thrown', () => {
    render(
      <QuizErrorBoundary>
        <ThrowError shouldThrow={false} />
      </QuizErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});

