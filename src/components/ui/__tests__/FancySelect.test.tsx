import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import FancySelect from '../FancySelect';

describe('FancySelect', () => {
  const defaultProps = {
    id: 'test-select',
    name: 'testField',
    value: '',
    onChange: jest.fn(),
    options: [
      { label: 'Select an option', value: '' },
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
      { label: 'Option 3', value: 'opt3' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder when no value selected', () => {
    render(<FancySelect {...defaultProps} />);
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('renders selected option label', () => {
    render(<FancySelect {...defaultProps} value="opt1" />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('calls onChange when option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FancySelect {...defaultProps} onChange={onChange} />);

    const button = screen.getByRole('combobox');
    await user.click(button);

    const option = screen.getByText('Option 1');
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'testField', value: 'opt1' },
    });
  });

  it('opens dropdown on button click', async () => {
    const user = userEvent.setup();
    render(<FancySelect {...defaultProps} />);

    const button = screen.getByRole('combobox');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <FancySelect {...defaultProps} />
        <button>Outside</button>
      </div>
    );

    const selectButton = screen.getByRole('combobox');
    await user.click(selectButton);
    expect(selectButton).toHaveAttribute('aria-expanded', 'true');

    const outsideButton = screen.getByText('Outside');
    await user.click(outsideButton);

    expect(selectButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('handles keyboard navigation with ArrowDown', async () => {
    const user = userEvent.setup();
    render(<FancySelect {...defaultProps} />);

    const button = screen.getByRole('combobox');
    button.focus();
    await user.keyboard('{ArrowDown}');

    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('handles Enter key to select highlighted option', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FancySelect {...defaultProps} onChange={onChange} />);

    const button = screen.getByRole('combobox');
    await user.click(button);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalled();
  });

  it('handles Escape key to close dropdown', async () => {
    const user = userEvent.setup();
    render(<FancySelect {...defaultProps} />);

    const button = screen.getByRole('combobox');
    await user.click(button);
    await user.keyboard('{Escape}');

    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('displays error message when error prop is provided', () => {
    render(<FancySelect {...defaultProps} error="This field is required" />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is disabled when disabled prop is true', () => {
    render(<FancySelect {...defaultProps} disabled={true} />);

    const button = screen.getByRole('combobox');
    expect(button).toBeDisabled();
  });

  it('does not open when disabled and clicked', async () => {
    const user = userEvent.setup();
    render(<FancySelect {...defaultProps} disabled={true} />);

    const button = screen.getByRole('combobox');
    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('highlights option on mouse enter', async () => {
    const user = userEvent.setup();
    render(<FancySelect {...defaultProps} />);

    const button = screen.getByRole('combobox');
    await user.click(button);

    const option = screen.getByText('Option 2');
    await user.hover(option);

    expect(option).toHaveAttribute('data-highlight', 'true');
  });

  it('shows selected option with aria-selected', async () => {
    const user = userEvent.setup();
    render(<FancySelect {...defaultProps} value="opt2" />);

    const button = screen.getByRole('combobox');
    await user.click(button);

    const selectedOption = screen.getByRole('option', { name: 'Option 2', selected: true });
    expect(selectedOption).toHaveAttribute('aria-selected', 'true');
  });
});

