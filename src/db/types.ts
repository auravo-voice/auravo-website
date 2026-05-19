/** App-level user profile (backed by PocketBase `users` auth collection). */
export type UserProfileRow = {
  id: string;
  displayName: string;
  onboardingGoalId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SessionScoresRow = {
  id: string;
  sessionId: string;
  pronunciation: number;
  grammar: number;
  fluency: number;
  vocabulary: number;
  fillerWords: number;
  pacing: number;
  createdAt: number;
};
