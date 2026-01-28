/**
 * Voice Archetype Quiz Scoring System
 * Calculates archetype scores and determines primary archetype
 */

export type ArchetypeName = 'Analyst' | 'Connector' | 'Leader' | 'Hidden Voice';

export interface QuizAnswer {
  archetype: ArchetypeName;
  [key: string]: unknown;
}

export interface ArchetypeScores {
  Analyst: number;
  Connector: number;
  Leader: number;
  'Hidden Voice': number;
}

export interface ArchetypePercentages {
  Analyst: number;
  Connector: number;
  Leader: number;
  'Hidden Voice': number;
}

export interface ScoringResults {
  archetype: ArchetypeName;
  scores: ArchetypeScores;
  percentages: ArchetypePercentages;
  allArchetypes: ArchetypeName[];
  isTied: boolean;
  tiedArchetypes: ArchetypeName[];
  totalAnswers: number;
}

/**
 * Calculate archetype scores from quiz answers
 * @param answers - Array of answer objects with archetype property
 * @returns Scoring results with primary archetype and score breakdown
 */
export const calculateArchetypeScores = (answers: (QuizAnswer | null)[]): ScoringResults => {
  // Initialize scores for all archetypes
  const scores: ArchetypeScores = {
    Analyst: 0,
    Connector: 0,
    Leader: 0,
    'Hidden Voice': 0,
  };

  // Each answer contributes 1 point to its archetype
  // (We use 1 point instead of 0.25 for simplicity, since all questions have equal weight)
  answers.forEach((answer, index) => {
    if (answer && answer.archetype) {
      scores[answer.archetype] += 1;
      
      // Optional: Add slight weight to later questions (for tie-breaking)
      // This gives more weight to answers later in the quiz
      const recencyBonus = index * 0.01;
      scores[answer.archetype] += recencyBonus;
    }
  });

  // Find the primary archetype (highest score)
  const sortedArchetypes = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [ArchetypeName, number][];
  const primaryArchetype = sortedArchetypes[0][0];
  const primaryScore = sortedArchetypes[0][1];

  // Check for ties (scores within 1 point of the primary)
  const tiedArchetypes = sortedArchetypes
    .filter(([_, score]) => Math.abs(score - primaryScore) < 1)
    .map(([archetype, _]) => archetype);

  // Create ranked list of all archetypes
  const allArchetypes = sortedArchetypes.map(([archetype, _]) => archetype);

  // Calculate percentage for each archetype
  const totalPoints = answers.length;
  const percentages: ArchetypePercentages = {
    Analyst: Math.round((scores.Analyst / totalPoints) * 100),
    Connector: Math.round((scores.Connector / totalPoints) * 100),
    Leader: Math.round((scores.Leader / totalPoints) * 100),
    'Hidden Voice': Math.round((scores['Hidden Voice'] / totalPoints) * 100),
  };

  return {
    archetype: primaryArchetype,
    scores: scores,
    percentages: percentages,
    allArchetypes: allArchetypes,
    isTied: tiedArchetypes.length > 1,
    tiedArchetypes: tiedArchetypes,
    totalAnswers: answers.length,
  };
};

/**
 * Validate that all questions have been answered
 * @param answers - Array of answers
 * @param totalQuestions - Total number of questions
 * @returns True if all questions answered
 */
export const validateAnswersComplete = (answers: (QuizAnswer | null)[], totalQuestions: number): boolean => {
  return answers.length === totalQuestions && answers.every((answer) => answer !== null);
};

/**
 * Get archetype color
 * @param archetypeName - Name of the archetype
 * @returns Hex color code
 */
export const getArchetypeColor = (archetypeName: ArchetypeName | string): string => {
  const colors: Record<ArchetypeName, string> = {
    Analyst: "#3B82F6",
    Connector: "#F97316",
    Leader: "#8B5CF6",
    "Hidden Voice": "#10B981",
  };
  return colors[archetypeName as ArchetypeName] || "#6B8F71";
};

/**
 * Format score for display
 * @param score - Raw score
 * @param total - Total possible score
 * @returns Formatted score percentage
 */
export const formatScore = (score: number, total: number): string => {
  const percentage = Math.round((score / total) * 100);
  return `${percentage}%`;
};

