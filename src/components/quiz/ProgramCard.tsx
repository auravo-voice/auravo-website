import React from 'react';

interface Program {
  title: string;
  relevance: string;
  description: string;
}

interface ProgramCardProps {
  program: Program;
  index: number;
  archetypeColor: string;
}

/**
 * ProgramCard Component
 * Displays a recommended program in the results section
 */
const ProgramCard: React.FC<ProgramCardProps> = ({ program, index, archetypeColor }) => {
  return (
    <div 
      className="bg-neutral-900 rounded-xl p-6 border-2 border-neutral-700 hover:border-neon-blue/50 transition-all duration-300 hover:shadow-glow-soft transform hover:-translate-y-1 animate-fade-in-up group relative"
      style={{ animationDelay: `${0.6 + index * 0.1}s` }}
    >
      {/* Program Number Badge */}
      <div className="flex items-start gap-4 mb-3">
        <div 
          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-md"
          style={{ backgroundColor: archetypeColor }}
        >
          {index + 1}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-neutral-100 text-lg mb-1 group-hover:text-neon-blue transition-colors duration-300">
            {program.title}
          </h4>
        </div>
      </div>

      {/* Relevance Tag */}
      <div className="mb-3">
        <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-neon-blue bg-neon-blue/20 px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-blue"></span>
          Why this fits you
        </span>
      </div>

      {/* Relevance Text */}
      <p className="text-body text-neutral-400 mb-3 italic">
        "{program.relevance}"
      </p>

      {/* Description */}
      <p className="text-body-sm text-neutral-400 leading-relaxed">
        {program.description}
      </p>

      {/* Decorative element */}
      <div className="pointer-events-none absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-neon-blue/10 to-transparent rounded-tl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </div>
  );
};

export default ProgramCard;

