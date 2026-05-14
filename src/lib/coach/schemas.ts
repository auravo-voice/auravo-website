import { z } from "zod";

export const dimensionSchema = z.object({
  key: z.string(),
  label: z.string(),
  score: z.coerce.number().min(0).max(100),
});

export const dashboardCoachSchema = z.object({
  user: z.object({
    name: z.string(),
    streak: z.coerce.number().int().min(0),
    goal: z.string(),
  }),
  dimensions: z.array(dimensionSchema).length(6),
  todaySession: z.object({
    title: z.string(),
    durationMin: z.coerce.number().int().min(5).max(90),
    focus: z.string(),
    exercises: z.coerce.number().int().min(1).max(12),
  }),
  coachBlurb: z.string().optional(),
});

export type DashboardCoachPayload = z.infer<typeof dashboardCoachSchema>;

// Note: The Ollama-driven `learningPathSchema` was removed when the learning-path page switched to the deterministic
// per-user, per-ISO-week generator in `src/lib/practice/week-plan.ts`. The new shape (`WeekPlan` / `WeekDay`) is
// rendered directly without going through Zod or `unstable_cache`.

export const scenarioRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
});

export const scenariosLibrarySchema = z.object({
  scenarios: z.array(scenarioRowSchema).min(4).max(16),
});

export type ScenariosLibraryPayload = z.infer<typeof scenariosLibrarySchema>;

export const progressJournalSchema = z.object({
  timeline: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        title: z.string(),
        scenario: z.string(),
        durationSec: z.coerce.number().int().min(60).max(7200),
        score: z.coerce.number().min(0).max(100),
      }),
    )
    .min(3)
    .max(12),
  milestones: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        date: z.string(),
      }),
    )
    .min(1)
    .max(8),
  weeklyTrend: z.array(z.coerce.number().min(0).max(100)).length(7),
  summary: z.string().optional(),
});

export type ProgressJournalPayload = z.infer<typeof progressJournalSchema>;

// Note: The legacy single-shot `meetingPrepSchema` was removed when Phase E replaced the inline coach call with
// `src/lib/meeting-prep/plan.ts` (richer plan + editable UI + rehearsal flow). The new shape lives in
// `src/lib/meeting-prep/types.ts` (`MeetingPlan`).

export type RadarDimension = z.infer<typeof dimensionSchema>;
