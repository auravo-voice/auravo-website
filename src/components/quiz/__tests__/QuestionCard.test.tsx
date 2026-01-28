import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import QuestionCard from '../QuestionCard';

const mockQuestion = {
  id: 1,
  question: 'What is your communication style?',
  options: [
    { text: 'Option A', archetype: 'Analyst' },
    { text: 'Option B', archetype: 'Connector' },
    { text: 'Option C', archetype: 'Leader' },
    { text: 'Option D', archetype: 'Hidden Voice' },
  ],
};

describe('QuestionCard', () => {
  it('renders question text', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        selectedOption={null}
        onSelectOption={jest.fn()}
      />
    );

    expect(screen.getByText('What is your communication style?')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        selectedOption={null}
        onSelectOption={jest.fn()}
      />
    );

    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
    expect(screen.getByText('Option D')).toBeInTheDocument();
  });

  it('calls onSelectOption when an option is clicked', async () => {
    const user = userEvent.setup();
    const onSelectOption = jest.fn();

    render(
      <QuestionCard
        question={mockQuestion}
        selectedOption={null}
        onSelectOption={onSelectOption}
      />
    );

    await user.click(screen.getByText('Option A'));
    expect(onSelectOption).toHaveBeenCalledWith(0);
  });

  it('highlights selected option', () => {
    const { container } = render(
      <QuestionCard
        question={mockQuestion}
        selectedOption={1}
        onSelectOption={jest.fn()}
      />
    );

    const optionB = screen.getByText('Option B').closest('button');
    expect(optionB).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders option labels (A, B, C, D)', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        selectedOption={null}
        onSelectOption={jest.fn()}
      />
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});

