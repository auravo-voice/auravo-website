import "server-only";
import {
  progressJournalSchema,
  scenariosLibrarySchema,
  type ProgressJournalPayload,
  type ScenariosLibraryPayload,
} from "@/lib/coach/schemas";

// Note: `FALLBACK_LEARNING_PATH` was removed when the learning-path page switched off the Ollama coach onto the
// deterministic `buildWeekPlan` generator in `src/lib/practice/week-plan.ts`. Every learner now gets a real plan
// derived from their baseline scores; no static fallback content is needed.

export const FALLBACK_PROGRESS: ProgressJournalPayload = progressJournalSchema.parse({
  summary: "Sample journal entries until live progress synthesis returns.",
  timeline: [
    {
      id: "fb-1",
      date: "2026-05-10",
      title: "Interview simulation — product sense",
      scenario: "Interview",
      durationSec: 900,
      score: 78,
    },
    {
      id: "fb-2",
      date: "2026-05-08",
      title: "Client renewal call rehearsal",
      scenario: "Client call",
      durationSec: 1200,
      score: 74,
    },
    {
      id: "fb-3",
      date: "2026-05-06",
      title: "Executive update — tight narrative",
      scenario: "Meeting",
      durationSec: 720,
      score: 81,
    },
  ],
  milestones: [
    { id: "m1", label: "First 80+ session score", date: "2026-05-10" },
    { id: "m2", label: "Seven-day practice streak", date: "2026-05-04" },
  ],
  weeklyTrend: [58, 61, 63, 66, 70, 74, 78],
});

export const FALLBACK_SCENARIOS: ScenariosLibraryPayload = scenariosLibrarySchema.parse({
  scenarios: [
    {
      id: "fb-s1",
      title: "Technical phone screen — explain a recent trade-off",
      category: "Interviews",
      difficulty: "Medium",
    },
    {
      id: "fb-s2",
      title: "Enterprise renewal call with budget pushback",
      category: "Client calls",
      difficulty: "Hard",
    },
    {
      id: "fb-s3",
      title: "Weekly leadership sync — crisp wins and asks",
      category: "Meetings",
      difficulty: "Easy",
    },
    {
      id: "fb-s4",
      title: "Two-minute product pitch to a skeptical room",
      category: "Pitch",
      difficulty: "Medium",
    },
  ],
});

// Note: The single-shot `FALLBACK_MEETING_PREP` was removed in Phase E. Meeting-prep fallback content now lives in
// `src/lib/meeting-prep/plan.ts` (the deterministic plan used when the local coach is unavailable).
