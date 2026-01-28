import React, { memo } from 'react';

interface QuizOption {
  text: string;
  archetype: string;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
}

interface QuestionCardProps {
  question: QuizQuestion;
  selectedOption: number | null;
  onSelectOption: (index: number) => void;
}

/**
 * QuestionCard Component
 * Displays a single question with four answer options
 */
const QuestionCard = memo<QuestionCardProps>(({ question, selectedOption, onSelectOption }) => {
  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in-up">
      {/* Question Text */}
      <div className="mb-8 text-center">
        <h2 className="text-h2 md:text-h1 text-neutral-100 leading-tight px-4">
          {question.question}
        </h2>
      </div>

      {/* Answer Options - native radio group so selection works reliably in Safari */}
      <div
        className="grid md:grid-cols-2 gap-4"
        role="radiogroup"
        aria-label="Choose one answer"
      >
        {question.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const label = optionLabels[index];
          const inputId = `q-${question.id}-opt-${index}`;

          return (
            <label
              key={index}
              htmlFor={inputId}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectOption(index);
              }}
              className={`
                group relative w-full p-6 rounded-xl border-2 text-left transition-all duration-300 transform cursor-pointer
                hover:scale-[1.02] hover:shadow-glow-soft focus-within:ring-2 focus-within:ring-neon-blue focus-within:ring-offset-2 focus-within:ring-offset-neutral-950
                ${
                  isSelected
                    ? 'border-neon-blue bg-neon-blue/10 shadow-glow-soft'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neon-blue/50 hover:bg-neutral-800'
                }
              `}
            >
              <input
                type="radio"
                id={inputId}
                name={`quiz-q-${question.id}`}
                value={index}
                checked={isSelected}
                readOnly
                className="sr-only"
                aria-label={`Option ${label}: ${option.text}`}
              />
              {/* Option Label */}
              <div
                className={`
                  absolute -top-3 -left-3 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  transition-all duration-300 shadow-md pointer-events-none
                  ${
                    isSelected
                      ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white scale-110'
                      : 'bg-neutral-800 text-neutral-400 group-hover:bg-neon-blue/20 group-hover:text-neon-blue'
                  }
                `}
              >
                {label}
              </div>

              {/* Checkmark for selected option */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-neon-blue text-white flex items-center justify-center shadow-lg animate-scale-in">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              )}

              {/* Option Text */}
              <p
                className={`
                  text-body leading-relaxed transition-colors duration-300 pl-2 pointer-events-none
                  ${isSelected ? 'text-neutral-100 font-medium' : 'text-neutral-300 group-hover:text-neutral-100'}
                `}
              >
                {option.text}
              </p>

              {/* Hover glow effect */}
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-neon-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </label>
          );
        })}
      </div>
    </div>
  );
});

QuestionCard.displayName = 'QuestionCard';

export default QuestionCard;

