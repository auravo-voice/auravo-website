import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

/**
 * ProgressBar Component
 * Shows quiz progress with animated bar and question counter
 */
const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto mb-8" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}>
      {/* Question Counter */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-body-sm font-medium text-neutral-400">
          Question {current} of {total}
        </span>
        <span className="text-body-sm font-semibold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
          {percentage}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        >
          {/* Animated shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
        </div>
      </div>

      {/* Progress Dots (optional, for visual variety) */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {Array.from({ length: total }).map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index < current
                ? 'w-6 bg-neon-blue'
                : index === current
                ? 'w-8 bg-neon-blue/50'
                : 'w-1.5 bg-neutral-600'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;

