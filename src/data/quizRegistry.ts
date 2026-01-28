import { quizV1 } from './quizzes/v1';
import { QUIZ_VERSION } from './quizVersion';

export interface Quiz {
  id: number;
  question: string;
  options: Array<{
    text: string;
    archetype: 'Analyst' | 'Connector' | 'Leader' | 'Hidden Voice';
  }>;
}

export const QUIZZES: Record<string, Quiz[]> = {
  v1: quizV1,
};

export function getQuizByVersion(version: string): Quiz[] {
  return QUIZZES[version] || quizV1;
}

export function getActiveQuiz(): Quiz[] {
  return getQuizByVersion(QUIZ_VERSION);
}

