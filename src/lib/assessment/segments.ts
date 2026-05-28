/** Canonical segment kinds for the four-part initial assessment (Step 2 of the core experience). */
export const ASSESSMENT_SEGMENT_KINDS = ["passage", "open_q1", "open_q2", "visual"] as const;
export type AssessmentSegmentKind = (typeof ASSESSMENT_SEGMENT_KINDS)[number];

export function isAssessmentSegmentKind(v: unknown): v is AssessmentSegmentKind {
  return typeof v === "string" && (ASSESSMENT_SEGMENT_KINDS as readonly string[]).includes(v);
}

/**
 * Hard-coded prompts. Keep these deterministic and short — the model never decides what learners hear during the
 * baseline. The visual segment uses a fixed photograph in `visual-prompt-scene.tsx` so the
 * description task is grounded in something we both see.
 */
export const ASSESSMENT_PROMPTS: Record<
  AssessmentSegmentKind,
  {
    title: string;
    /** Plain-language instructions shown above the recorder controls. */
    intro: string;
    /** Optional read-aloud passage (only used for the "passage" segment). */
    passage?: string;
    /** Target recording length in seconds — surfaces as a soft target, not a hard cap. */
    targetSeconds: number;
  }
> = {
  passage: {
    title: "Read this passage aloud",
    intro:
      "Read the paragraph below at a natural pace. We are listening for clarity, pacing, and how cleanly you handle consonant clusters and longer words.",
    passage:
      "Auravo is a speaking coach you can use anywhere. Each session takes about ten minutes. You speak first; the app listens, then offers a short, specific note. Over time, the same six dimensions — pronunciation, grammar, fluency, vocabulary, filler words, and pacing — get measurably stronger. Today is the first measurement, so speak the way you normally speak.",
    targetSeconds: 30,
  },
  open_q1: {
    title: "Tell us about something you are working on",
    intro:
      "Speak for about a minute. Describe one project, class, or initiative you are currently working on: what it is, what your contribution looks like, and what you are trying to get better at.",
    targetSeconds: 60,
  },
  open_q2: {
    title: "Describe a recent conversation that did not go well",
    intro:
      "About a minute. Pick a recent professional or academic conversation — meeting, interview, presentation — that did not go the way you wanted. Walk us through what happened and what you would do differently.",
    targetSeconds: 60,
  },
  visual: {
    title: "Describe what you see",
    intro:
      "Look at the photograph and describe it as if you were on a phone call with a friend who cannot see it. Spend about 30 seconds — set the scene, name the people and details you notice, and finish with one observation about what is going on.",
    targetSeconds: 30,
  },
};

export function segmentDisplayLabel(kind: AssessmentSegmentKind): string {
  switch (kind) {
    case "passage":
      return "Passage";
    case "open_q1":
      return "Open question 1";
    case "open_q2":
      return "Open question 2";
    case "visual":
      return "Visual prompt";
  }
}

/** Aggregate target duration across all four segments — used in the intro screen "about N minutes" copy. */
export function totalAssessmentTargetSeconds(): number {
  return ASSESSMENT_SEGMENT_KINDS.reduce((a, k) => a + ASSESSMENT_PROMPTS[k].targetSeconds, 0);
}
