import React from 'react';

interface QuizNavigationProps {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastQuestion: boolean;
  currentQuestion: number;
  totalQuestions: number;
}

/**
 * Navigation Component
 * Back and Next/Submit buttons for quiz navigation (purely React state; no data attributes for external handlers).
 */
const QuizNavigation: React.FC<QuizNavigationProps> = ({
  onBack,
  onNext,
  canGoBack,
  canGoNext,
  isLastQuestion,
  currentQuestion,
  totalQuestions,
}) => {
  return (
    <div className="relative z-10 w-full max-w-3xl mx-auto mt-8 flex items-center justify-between gap-4">
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        className={`
          px-6 py-3 rounded-lg font-medium transition-all duration-300 
          inline-flex items-center gap-2 min-w-[120px] justify-center
          ${
            canGoBack
              ? 'bg-neutral-900 border-2 border-neutral-600 text-neutral-200 hover:border-neon-blue hover:text-neon-blue hover:shadow-glow-soft transform hover:scale-105'
              : 'bg-neutral-800/50 text-neutral-500 cursor-not-allowed opacity-50'
          }
        `}
        aria-label="Go to previous question"
        aria-disabled={!canGoBack}
      >
        <span className={`transform transition-transform duration-300 ${canGoBack ? 'group-hover:-translate-x-1' : ''}`}>
          ←
        </span>
        <span>Back</span>
      </button>

      {/* Next: always advances. See Results: disabled until all questions answered. */}
      <button
        type="button"
        disabled={isLastQuestion && !canGoNext}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onNext();
        }}
        className={`
          quiz-next-base px-8 py-3 rounded-lg font-semibold transition-all duration-300 inline-flex items-center gap-2 min-w-[120px] justify-center group
          ${canGoNext || !isLastQuestion
            ? 'cursor-pointer bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:shadow-glow transform hover:scale-105'
            : 'cursor-not-allowed bg-neutral-700 text-neutral-500'}
        `}
        aria-label={isLastQuestion ? 'Submit quiz and see results' : 'Go to next question'}
        aria-disabled={isLastQuestion && !canGoNext}
      >
        <span>{isLastQuestion ? 'See Results' : 'Next'}</span>
        <span className="quiz-next-arrow transform transition-transform duration-300 group-hover:translate-x-1">
          {isLastQuestion ? '✓' : '→'}
        </span>
      </button>
    </div>
  );
};

export default QuizNavigation;

