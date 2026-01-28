import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders current and total questions', () => {
    render(<ProgressBar current={5} total={14} />);

    expect(screen.getByText('Question 5 of 14')).toBeInTheDocument();
  });

  it('calculates and displays correct percentage', () => {
    render(<ProgressBar current={7} total={14} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders progress bar with correct width', () => {
    const { container } = render(<ProgressBar current={3} total={10} />);
    const progressBar = container.querySelector('[role="progressbar"]');
    
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '3');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '10');
  });

  it('renders correct number of progress dots', () => {
    const { container } = render(<ProgressBar current={2} total={5} />);
    const dots = container.querySelectorAll('[aria-hidden="true"]');
    
    expect(dots).toHaveLength(5);
  });
});

