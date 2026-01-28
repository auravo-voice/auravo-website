import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getActiveQuiz, type Quiz } from '../../data/quizRegistry';
import { QUIZ_VERSION } from '../../data/quizVersion';
import { 
  calculateArchetypeScores, 
  type QuizAnswer,
  type ArchetypeScores,
  type ArchetypePercentages,
  type ArchetypeName
} from '../../data/scoringSystem';
import { saveUserDetails } from '../../lib/supabase';
import IntroScreen from './IntroScreen';
import QuestionCard from './QuestionCard';
import ProgressBar from './ProgressBar';
import ResultsCard from './ResultsCard';

type QuizOption = Quiz['options'][number];

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

type Phase = 'intro' | 'quiz' | 'results';
type StartStatus = 'idle' | 'saving' | 'error';

export interface VoiceArchetypeQuizProps {
  /** When 'quiz', skip intro and show questions immediately. Used by /voice-quiz?start=1. */
  startPhase?: 'intro' | 'quiz';
}

/**
 * VoiceArchetypeQuiz - Main Quiz Component
 * Manages quiz state and orchestrates the three phases: intro, quiz, results
 */
const VoiceArchetypeQuiz: React.FC<VoiceArchetypeQuizProps> = ({ startPhase = 'intro' }) => {
  const quiz = getActiveQuiz();

  const [phase, setPhase] = useState<Phase>(() => (startPhase === 'quiz' ? 'quiz' : 'intro'));
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(QuizOption | null)[]>(() => {
    if (typeof window === 'undefined') return Array(quiz.length).fill(null);
    try {
      const raw = sessionStorage.getItem('quiz-answers');
      if (raw) {
        const parsed = JSON.parse(raw) as (QuizOption | null)[];
        if (Array.isArray(parsed) && parsed.length === quiz.length) return parsed;
      }
    } catch (_) {}
    return Array(quiz.length).fill(null);
  });
  const [results, setResults] = useState<QuizResults | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [startStatus, setStartStatus] = useState<StartStatus>('idle'); // idle | saving | error
  const [startError, setStartError] = useState('');
  /** Sync selection for enabling Next even if answers state hasn't flushed (e.g. batching/hydration). */
  const [pendingSelectionIndex, setPendingSelectionIndex] = useState<number | null>(null);
  /** Explicitly set when user selects so Next button style updates reliably (Safari). */
  const [nextEnabled, setNextEnabled] = useState(false);

  /** Set synchronously on option select so Next works even if React hasn't re-rendered (Safari). */
  const selectionRef = useRef<number | null>(null);
  /** Next button DOM ref: we update its look imperatively so it reflects enabled state (e.g. Safari). */
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  const totalQuestions = quiz.length;

  const setNextButtonEnabled = useCallback((enabled: boolean) => {
    const el = nextButtonRef.current;
    if (!el) return;
    if (enabled) {
      el.classList.add('quiz-next-enabled');
      el.setAttribute('aria-disabled', 'false');
    } else {
      el.classList.remove('quiz-next-enabled');
      el.setAttribute('aria-disabled', 'true');
    }
  }, []);

  // Clear pending selection when moving to another question
  useEffect(() => {
    setPendingSelectionIndex(null);
    setNextEnabled(false);
    selectionRef.current = null;
    setNextButtonEnabled(false);
  }, [currentQuestion, setNextButtonEnabled]);

  const totalQuestionsRef = useRef(totalQuestions);
  totalQuestionsRef.current = totalQuestions;

  /**
   * Start the quiz - save details to Supabase, then navigate to quiz phase only on success.
   * Timeout prevents API hang from leaving the button stuck; try/catch/finally always re-enable.
   */
  const handleStartQuiz = useCallback(async (userInfo: UserData) => {
    setUserData(userInfo);
    setStartStatus('saving');
    setStartError('');

    const SAVE_TIMEOUT_MS = 12000;
    const timeoutPromise = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Request timed out. You can start the quiz below.')), SAVE_TIMEOUT_MS)
    );

    let response: { success: boolean; data?: { id: string }; error?: { message: string } };
    try {
      response = await Promise.race([
        saveUserDetails(userInfo) as Promise<{ success: boolean; data?: { id: string }; error?: { message: string } }>,
        timeoutPromise,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setStartError(message);
      return;
    } finally {
      setStartStatus('idle');
    }

    if (response.success === true && response.data?.id) {
      setSubmissionId(response.data.id);
      setPhase('quiz');
      setCurrentQuestion(0);
    } else {
      if (response.error?.message) {
        setStartError(response.error.message);
      } else {
        setStartError('We couldn’t save your details. Please check your connection and try again.');
      }
    }
  }, []);

  /**
   * Handle option selection for current question.
   */
  const handleSelectOption = useCallback((optionIndex: number) => {
    const qIndex = currentQuestion;
    selectionRef.current = optionIndex;
    setNextButtonEnabled(true);
    setPendingSelectionIndex(optionIndex);
    setAnswers((prev) => {
      const newAnswers = [...prev];
      const selectedOption = quiz[qIndex].options[optionIndex];
      newAnswers[qIndex] = selectedOption;
      return newAnswers;
    });
  }, [quiz, currentQuestion, setNextButtonEnabled]);

  /**
   * Navigate to next question or submit quiz.
   * Uses selectionRef so Next works even if React didn't re-render (e.g. Safari).
   */
  const handleNext = useCallback(() => {
    console.log('[handleNext] fired', { currentQuestion, totalQuestions });
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion((prev) => {
        console.log('[handleNext] setCurrentQuestion', prev, '->', prev + 1);
        return prev + 1;
      });
      return;
    }
    // Last question: only submit when all questions are answered
    const allAnswered = answers.every(a => a !== null);
    if (!allAnswered) return;

    // Submit quiz and calculate results
    {
      const answersForScoring: (QuizAnswer | null)[] = answers.map(ans =>
        ans ? { archetype: ans.archetype as QuizAnswer['archetype'] } : null
      );
      const calculatedResults = calculateArchetypeScores(answersForScoring);
      const selections = answers.map((ans, idx) => {
        const q = quiz[idx];
        const optionIndex = q.options.findIndex(
          (o) => o.text === ans?.text && o.archetype === ans?.archetype
        );
        return {
          q: q.id,            // question id
          i: optionIndex,     // selected option index (0-based)
          a: ans?.archetype || null, // selected archetype
        };
      });
      const quizVersion = QUIZ_VERSION;
      setResults({
        archetype: calculatedResults.archetype,
        scores: calculatedResults.scores,
        percentages: calculatedResults.percentages,
        allArchetypes: calculatedResults.allArchetypes,
        isTied: calculatedResults.isTied,
        tiedArchetypes: calculatedResults.tiedArchetypes,
        totalAnswers: calculatedResults.totalAnswers,
        quiz_version: quizVersion,
        answers_compact: { quiz_version: quizVersion, selections },
      });
      try { sessionStorage.removeItem('quiz-answers'); } catch (_) {}
      setPhase('results');
    }
  }, [currentQuestion, totalQuestions, answers, quiz]);

  /**
   * Navigate to previous question.
   */
  const handleBack = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  }, [currentQuestion]);

  /**
   * Retake the quiz - reset all state. When startPhase is 'quiz', stay on quiz; otherwise go to intro.
   */
  const handleRetake = useCallback(() => {
    try { sessionStorage.removeItem('quiz-answers'); } catch (_) {}
    setPendingSelectionIndex(null);
    setNextEnabled(false);
    selectionRef.current = null;
    setNextButtonEnabled(false);
    if (startPhase === 'quiz') {
      setPhase('quiz');
      setCurrentQuestion(0);
      setAnswers(Array(quiz.length).fill(null));
      setResults(null);
      setUserData(null);
      setSubmissionId(null);
    } else {
      setPhase('intro');
      setCurrentQuestion(0);
      setAnswers(Array(quiz.length).fill(null));
      setResults(null);
      setUserData(null);
      setSubmissionId(null);
    }
  }, [quiz.length, startPhase, setNextButtonEnabled]);

  const isLastQuestion = currentQuestion === totalQuestions - 1;
  const allQuestionsAnswered = answers.every(a => a !== null);
  // Next: always enabled. See Results (last question): only when all questions are answered.
  const canGoNext = isLastQuestion ? allQuestionsAnswered : true;
  const canGoBack = currentQuestion > 0;

  // Persist answers so they survive page reload when Next triggers reload
  useEffect(() => {
    if (phase !== 'quiz' || typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('quiz-answers', JSON.stringify(answers));
    } catch (_) {}
  }, [phase, answers]);

  // Get current question data
  const currentQuestionData = quiz[currentQuestion];

  // Get selected option index: prefer stored answer so selection doesn’t deselect on outside click
  const fromAnswers =
    answers[currentQuestion]
      ? quiz[currentQuestion].options.findIndex(
          (opt) =>
            opt.archetype === answers[currentQuestion]?.archetype &&
            opt.text === answers[currentQuestion]?.text
        )
      : -1;
  const selectedOptionIndex =
    fromAnswers >= 0 ? fromAnswers : pendingSelectionIndex;

  return (
    <div className="min-h-screen min-h-[100svh] bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Back to website – always allowed */}
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-neon-blue-light hover:text-neon-blue font-medium"
            aria-label="Go back to website"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back to website</span>
          </a>
        </div>
        
        {/* INTRO PHASE */}
        {phase === 'intro' && (
          <IntroScreen 
            onStart={handleStartQuiz}
            onStartDirect={() => {
              setPhase('quiz');
              setCurrentQuestion(0);
            }}
            isStarting={startStatus === 'saving'}
            startError={startError}
          />
        )}

        {/* QUIZ PHASE */}
        {phase === 'quiz' && (
          <div className="animate-fade-in">
            {!submissionId && (
              <p className="text-center text-body-sm text-amber-400/90 mb-4">
                Your progress won’t be saved this time. You can still complete the quiz and see your results.
              </p>
            )}
            {/* Progress Bar – key removed temporarily to test if key caused remount/deselect */}
            <ProgressBar
              current={currentQuestion + 1}
              total={totalQuestions}
            />

            {/* Question Card – key removed temporarily to test if key caused remount/deselect */}
            <QuestionCard
              question={currentQuestionData}
              selectedOption={selectedOptionIndex}
              onSelectOption={handleSelectOption}
            />

            {/* Navigation: Back + Next or See Results */}
            <div className="relative z-10 w-full max-w-3xl mx-auto mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={!canGoBack}
                className={`
                  px-6 py-3 rounded-lg font-medium transition-all duration-300
                  inline-flex items-center gap-2 min-w-[120px] justify-center
                  ${canGoBack
                    ? 'bg-neutral-900 border-2 border-neutral-600 text-neutral-200 hover:border-neon-blue hover:text-neon-blue hover:shadow-glow-soft transform hover:scale-105'
                    : 'bg-neutral-800/50 text-neutral-500 cursor-not-allowed opacity-50'}
                `}
                aria-label="Go to previous question"
              >
                <span>←</span>
                <span>Back</span>
              </button>

              {!isLastQuestion ? (
                <button
                  ref={nextButtonRef}
                  type="button"
                  onClick={handleNext}
                  className="quiz-next-btn px-8 py-3 rounded-lg font-semibold transition-all duration-300 inline-flex items-center gap-2 min-w-[120px] justify-center group cursor-pointer bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:shadow-glow transform hover:scale-105"
                  aria-label="Go to next question"
                >
                  <span>Next</span>
                  <span>→</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allQuestionsAnswered}
                  onClick={handleNext}
                  className={`
                    px-8 py-3 rounded-lg font-semibold transition-all duration-300 inline-flex items-center gap-2 min-w-[120px] justify-center group
                    ${allQuestionsAnswered
                      ? 'cursor-pointer bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:shadow-glow transform hover:scale-105'
                      : 'cursor-not-allowed bg-neutral-700 text-neutral-500'}
                  `}
                  aria-label="Submit quiz and see results"
                >
                  <span>See Results</span>
                  <span>✓</span>
                </button>
              )}
            </div>

            {/* Helper text */}
            {!canGoNext && (
              <p className="text-center text-body-sm text-neutral-400 mt-6 animate-fade-in">
                Answer all questions to see your results
              </p>
            )}
          </div>
        )}

        {/* RESULTS PHASE */}
        {phase === 'results' && results && (
          <ResultsCard 
            results={results}
            userData={userData}
            submissionId={submissionId}
            onRetake={handleRetake}
          />
        )}
      </div>

      {/* Accessibility: Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {phase === 'quiz' && `Question ${currentQuestion + 1} of ${totalQuestions}`}
        {phase === 'results' && `Quiz complete. Your archetype is ${results?.archetype}`}
      </div>
    </div>
  );
};

export default VoiceArchetypeQuiz;

