'use client';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface LineByLineTextProps {
  text: string;
  className?: string;
  delay?: number;
  highlightKeywords?: string[];
}

/**
 * Luxury-tech text component that reveals line-by-line
 */
export const LineByLineText: React.FC<LineByLineTextProps> = ({
  text,
  className = '',
  delay = 0,
  highlightKeywords = [],
}) => {
  const prefersReducedMotion = useReducedMotion();
  
  // Split text into lines
  const lines = text.split('\n').filter(line => line.trim());

  if (prefersReducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {lines.map((line, index) => {
        // Check if line contains any keywords to highlight
        const shouldHighlight = highlightKeywords.some(keyword =>
          line.toLowerCase().includes(keyword.toLowerCase())
        );

        return (
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{
              duration: 0.4,
              delay: delay + index * 0.08,
              ease: 'easeOut',
            }}
            className="block"
          >
            {line.split(' ').map((word, wordIndex) => {
              const isKeyword = highlightKeywords.some(keyword =>
                word.toLowerCase().includes(keyword.toLowerCase())
              );

              return (
                <motion.span
                  key={wordIndex}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.25,
                    delay: delay + index * 0.08 + wordIndex * 0.02,
                    ease: 'easeOut',
                  }}
                  className={isKeyword ? 'brightness-110' : ''}
                  style={{ display: 'inline-block', marginRight: '0.25em' }}
                >
                  {word}
                  {wordIndex < line.split(' ').length - 1 && ' '}
                </motion.span>
              );
            })}
            {index < lines.length - 1 && <br />}
          </motion.span>
        );
      })}
    </span>
  );
};
