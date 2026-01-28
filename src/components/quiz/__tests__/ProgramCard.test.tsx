import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgramCard from '../ProgramCard';

const mockProgram = {
  title: 'Test Program',
  relevance: 'This program is perfect for you because...',
  description: 'A comprehensive program description.',
};

describe('ProgramCard', () => {
  it('renders program title', () => {
    render(<ProgramCard program={mockProgram} index={0} archetypeColor="#3B82F6" />);
    expect(screen.getByText('Test Program')).toBeInTheDocument();
  });

  it('renders program relevance', () => {
    render(<ProgramCard program={mockProgram} index={0} archetypeColor="#3B82F6" />);
    expect(screen.getByText(/This program is perfect for you/i)).toBeInTheDocument();
  });

  it('renders program description', () => {
    render(<ProgramCard program={mockProgram} index={0} archetypeColor="#3B82F6" />);
    expect(screen.getByText('A comprehensive program description.')).toBeInTheDocument();
  });

  it('displays correct program number', () => {
    render(<ProgramCard program={mockProgram} index={0} archetypeColor="#3B82F6" />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays correct program number for different index', () => {
    render(<ProgramCard program={mockProgram} index={2} archetypeColor="#3B82F6" />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies archetype color to number badge', () => {
    const { container } = render(
      <ProgramCard program={mockProgram} index={0} archetypeColor="#FF5733" />
    );
    
    const badge = container.querySelector('[style*="background-color"]');
    expect(badge).toHaveStyle({ backgroundColor: '#FF5733' });
  });
});

