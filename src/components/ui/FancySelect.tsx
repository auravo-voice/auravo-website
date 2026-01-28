import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  label: string;
  value: string;
}

interface FancySelectProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: { target: { name: string; value: string } }) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  error?: string | boolean;
  className?: string;
}

/**
 * FancySelect - A custom styled select component
 * Props:
 * - id, name
 * - value: string
 * - onChange: (eLike: { target: { name, value } }) => void
 * - options: Array<{ label: string, value: string }>
 * - placeholder?: string
 * - disabled?: boolean
 * - error?: string | boolean
 * - className?: string
 */
const FancySelect: React.FC<FancySelectProps> = ({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  error = '',
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [listStyle, setListStyle] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Position dropdown using button rect (viewport coords for position: fixed)
  const updateListPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setListStyle({
        top: rect.bottom + 8,
        left: rect.left,
        minWidth: rect.width,
      });
    }
  };

  useLayoutEffect(() => {
    if (open && buttonRef.current) {
      updateListPosition();
    } else {
      setListStyle(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updateListPosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
      setHighlightIdx(-1);
      setListStyle(null);
    }
    if (open) {
      document.addEventListener('click', handleClickOutside as EventListener);
      return () => document.removeEventListener('click', handleClickOutside as EventListener);
    }
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      // Scroll highlighted item into view
      const item = listRef.current.querySelector('[data-highlight="true"]');
      if (item && item.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlightIdx]);

  const selectIndex = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange({ target: { name, value: opt.value } });
    setOpen(false);
    setListStyle(null);
    setHighlightIdx(idx);
    if (buttonRef.current) buttonRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (e.key) {
      case ' ': // space
      case 'Enter':
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const idx = Math.max(0, options.findIndex((o) => o.value === value));
          setHighlightIdx(idx === -1 ? 0 : idx);
        } else if (highlightIdx >= 0) {
          selectIndex(highlightIdx);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const start = Math.max(0, options.findIndex((o) => o.value === value));
          setHighlightIdx(start === -1 ? 0 : start);
        } else {
          setHighlightIdx((prev) => (prev + 1) % options.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) {
          setHighlightIdx((prev) => (prev - 1 + options.length) % options.length);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          setHighlightIdx(-1);
        }
        break;
      default:
        break;
    }
  };

  const borderClass = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-neutral-600 focus:border-neon-blue focus:ring-neon-blue/20';

  return (
    <div
      ref={wrapperRef}
      className={`relative pointer-events-auto ${open ? 'z-[100]' : ''} ${className}`}
      style={{ isolation: open ? 'isolate' : undefined }}
    >
      <button
        id={id}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-invalid={!!error}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          const idx = Math.max(0, options.findIndex((o) => o.value === value));
          setHighlightIdx(idx === -1 ? 0 : idx);
          if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setListStyle({ top: rect.bottom + 8, left: rect.left, minWidth: rect.width });
          }
          setOpen((o) => !o);
        }}
        onKeyDown={handleKeyDown}
        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 bg-neutral-800 text-neutral-100 ${borderClass} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selectedOption ? 'text-neutral-100' : 'text-neutral-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 pointer-events-none">
          <svg className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {open &&
        listStyle &&
        createPortal(
          <ul
            id={`${id}-listbox`}
            ref={listRef}
            role="listbox"
            aria-activedescendant={highlightIdx >= 0 ? `${id}-option-${highlightIdx}` : undefined}
            tabIndex={-1}
            data-fancy-select-list
            style={{
              position: 'fixed',
              top: listStyle.top,
              left: listStyle.left,
              minWidth: listStyle.minWidth,
              zIndex: 2147483647,
              backgroundColor: 'rgb(38 38 38)',
            }}
            className="max-h-56 overflow-auto rounded-lg border border-neutral-600 shadow-xl focus:outline-none py-1"
          >
            {options.map((opt, idx) => {
              const selected = value === opt.value;
              const highlighted = idx === highlightIdx;
              return (
                <li
                  id={`${id}-option-${idx}`}
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  data-highlight={highlighted}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectIndex(idx);
                  }}
                  className={`px-4 py-2 cursor-pointer select-none text-sm ${
                    highlighted ? 'bg-neon-blue/20 text-neon-blue' : selected ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-300'
                  }`}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>,
          document.body
        )}

      {error && typeof error === 'string' && (
        <p className="text-red-400 text-body-sm mt-1">{error}</p>
      )}
    </div>
  );
};

export default FancySelect;

