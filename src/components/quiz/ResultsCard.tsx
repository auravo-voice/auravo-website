import React, { useState, useEffect, useRef } from 'react';
import { 
  getArchetypeColor, 
  type ArchetypeScores, 
  type ArchetypePercentages, 
  type ArchetypeName 
} from '@/data/scoringSystem';
import ProgramCard from './ProgramCard';
import { getArchetypeData, type ArchetypeData } from '@/data/archetypeData';
import { updateQuizResults, type QuizResults as SupabaseQuizResults } from '@/lib/supabase';

interface UserData {
  name: string;
  email: string;
  phone: string;
  occupation: string;
  ageGroup: string;
}

interface QuizResults {
  archetype: ArchetypeName;
  scores: ArchetypeScores;
  percentages: ArchetypePercentages;
  allArchetypes: ArchetypeName[];
  isTied: boolean;
  tiedArchetypes: ArchetypeName[];
  totalAnswers: number;
  quiz_version?: string;
  answers_compact?: {
    quiz_version: string;
    selections: Array<{
      q: number;
      i: number;
      a: string | null;
    }>;
  };
}


interface ResultsCardProps {
  results: QuizResults;
  userData: UserData | null;
  submissionId: string | null;
  onRetake: () => void;
}

type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

/**
 * ResultsCard Component
 * Displays the user's voice archetype results with full details
 */
const ResultsCard: React.FC<ResultsCardProps> = ({ results, userData, submissionId, onRetake }) => {
  const archetypeData = getArchetypeData(results.archetype) as ArchetypeData | null;
  const archetypeColor = getArchetypeColor(results.archetype);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>('idle'); // idle, submitting, success, error

  // Payload for Supabase: expects archetype, percentages as Record, answers_compact array
  const toSupabaseResults = (r: QuizResults): SupabaseQuizResults => ({
    archetype: r.archetype,
    percentages: { ...r.percentages },
    answers_compact: r.answers_compact?.selections ?? [],
    quiz_version: r.quiz_version,
  });

  // Retry handler for updating results
  const retryUpdate = async () => {
    if (!submissionId || !results) return;
    setSubmissionStatus('submitting');
    const response = await updateQuizResults(submissionId, toSupabaseResults(results));
    if (response.success) {
      setSubmissionStatus('success');
    } else {
      setSubmissionStatus('error');
    }
  };

  // STAGE 2: Update quiz results in Supabase when results are displayed
  useEffect(() => {
    if (submissionId && results) {
      // Update quiz results in Supabase (Stage 2)
      const updateData = async () => {
        setSubmissionStatus('submitting');
        const response = await updateQuizResults(submissionId, toSupabaseResults(results));

        if (response.success) {
          setSubmissionStatus('success');
        } else {
          setSubmissionStatus('error');
        }
      };
      
      updateData();
    }
  }, [submissionId, results]);

  if (!archetypeData) {
    return (
      <div className="text-center text-neutral-400">
        <p>Unable to load results. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Submission status banner */}
      {submissionStatus === 'submitting' && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400 text-body">
          Saving your results...
        </div>
      )}
      {submissionStatus === 'error' && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-red-400 text-body flex items-center justify-between gap-3">
          <span>We couldn't save your results. Please check your connection and try again.</span>
          <button onClick={retryUpdate} className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700">Retry</button>
        </div>
      )}
      {/* Hero Section - Archetype Reveal */}
      <div className="text-center mb-12 animate-fade-in">
        {/* Personalized Greeting */}
        {userData?.name && (
          <p className="text-body-lg text-neutral-400 mb-4 animate-fade-in-up">
            Hello, <span className="font-semibold text-neutral-100">{userData.name}</span>! 👋
          </p>
        )}

        {/* Emoji Icon */}
        <div 
          className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 animate-scale-in shadow-xl"
          style={{ 
            backgroundColor: `${archetypeColor}20`,
            border: `3px solid ${archetypeColor}`
          }}
        >
          <span className="text-5xl" role="img" aria-label={archetypeData.name}>
            {archetypeData.emoji}
          </span>
        </div>

        {/* Archetype Name */}
        <h1 
          className="text-h1 md:text-display font-bold mb-2 animate-fade-in-up"
          style={{ 
            animationDelay: '0.2s',
            color: archetypeColor 
          }}
        >
          {archetypeData.name}
        </h1>

        {/* Subtitle */}
        <p className="text-h2 text-neutral-400 mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {archetypeData.subtitle}
        </p>

        {/* Score Breakdown */}
        <div className="inline-flex items-center gap-2 bg-neutral-900 rounded-full px-6 py-3 border border-neutral-700 shadow-md animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <span className="text-body-sm font-medium text-neutral-400">Your match:</span>
          <span className="text-body font-bold" style={{ color: archetypeColor }}>
            {results.percentages[results.archetype] ?? '—'}%
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="bg-neutral-900 rounded-2xl p-8 mb-8 border border-neutral-700 shadow-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
        <p className="text-body-lg text-neutral-300 leading-relaxed text-center">
          {archetypeData.description}
        </p>
      </div>

      {/* Two Column Layout: Traits & Challenges */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {/* Strengths/Traits */}
        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-700 shadow-card animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center gap-2 mb-4">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: archetypeColor }}
            >
              ✨
            </div>
            <h3 className="text-h2 text-neutral-100">Your Strengths</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {archetypeData.traits.map((trait, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-body-sm font-medium border-2 transition-all duration-300 hover:scale-105"
                style={{ 
                  backgroundColor: `${archetypeColor}15`,
                  borderColor: archetypeColor,
                  color: archetypeColor
                }}
              >
                {trait}
              </span>
            ))}
          </div>
        </div>

        {/* Challenges */}
        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-700 shadow-card animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              🎯
            </div>
            <h3 className="text-h2 text-neutral-100">Growth Areas</h3>
          </div>
          <ul className="space-y-2">
            {archetypeData.challenges.slice(0, 4).map((challenge, index) => (
              <li key={index} className="flex items-start gap-2 text-body-sm text-neutral-300">
                <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                <span>{challenge}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Growth Path */}
      <div 
        className="rounded-2xl p-8 mb-10 border-2 shadow-card-lg animate-fade-in-up relative overflow-hidden bg-neutral-900/80"
        style={{ 
          animationDelay: '0.8s',
          borderColor: archetypeColor,
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
              style={{ backgroundColor: archetypeColor }}
            >
              🚀
            </div>
            <h3 className="text-h2 text-neutral-100">Your Growth Path</h3>
          </div>
          <p className="text-body text-neutral-300 leading-relaxed">
            {archetypeData.growthPath}
          </p>
        </div>

        {/* Decorative background */}
        <div 
          className="pointer-events-none absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: archetypeColor }}
        ></div>
      </div>

      {/* Recommended Programs */}
      <div className="mb-10">
        <div className="text-center mb-8 animate-fade-in-up" style={{ animationDelay: '0.9s' }}>
          <h3 className="text-h1 bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent mb-2">Programs Built For You</h3>
          <p className="text-body-lg text-neutral-400">
            Personalized coaching experiences designed for {archetypeData.name}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {archetypeData.programs.map((program, index) => (
            <ProgramCard
              key={index}
              program={program}
              index={index}
              archetypeColor={archetypeColor}
            />
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center bg-neutral-900 rounded-2xl p-10 border border-neutral-700 shadow-card animate-fade-in-up" style={{ animationDelay: '1s' }}>
        <h3 className="text-h2 text-neutral-100 mb-4">Ready to Transform Your Voice?</h3>
        <p className="text-body text-neutral-400 mb-6 max-w-2xl mx-auto">
          Book a free discovery call to explore which program is the perfect fit for your journey.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="https://zcal.co/thesignaturevoice"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold px-8 py-4 rounded-lg hover:shadow-glow transition-all duration-300 transform hover:scale-105 inline-flex items-center gap-2 group"
          >
            <span>Book Free Discovery Call</span>
            <span className="transform group-hover:translate-x-1 transition-transform duration-300">→</span>
          </a>
          <button
            onClick={onRetake}
            className="border-2 border-neutral-600 text-neutral-300 font-medium px-6 py-3 rounded-lg hover:border-neon-blue hover:text-neon-blue transition-all duration-300 transform hover:scale-105"
          >
            Retake Quiz
          </button>
        </div>
      </div>

      {/* Score Details (Optional - for transparency) */}
      <details className="mt-8 text-center">
        <summary className="text-body-sm text-neutral-500 cursor-pointer hover:text-neon-blue transition-colors duration-300 inline-flex items-center gap-2">
          <span>View detailed score breakdown</span>
          <span>▼</span>
        </summary>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {Object.entries(results.percentages).map(([archetype, percentage]) => (
            <div key={archetype} className="bg-neutral-900 rounded-lg p-4 border border-neutral-700">
              <div className="text-body-sm text-neutral-400 mb-1">{archetype}</div>
              <div className="text-h2 font-bold" style={{ color: getArchetypeColor(archetype) }}>
                {percentage}%
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

export default ResultsCard;

