import type { DimensionKey } from "@/lib/assessment/dimensions-from-scores";

export type PracticeGoalId = "interview" | "professional" | "academic" | "general";

export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

export type ExerciseCategory =
  | "filler_control"
  | "interview"
  | "client_call"
  | "pronunciation"
  | "pacing"
  | "confidence"
  | "grammar"
  | "vocabulary"
  | "fluency"
  | "simulation_meeting";

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  filler_control: "Filler control",
  interview: "Interview practice",
  client_call: "Client call",
  pronunciation: "Pronunciation",
  pacing: "Pacing",
  confidence: "Confidence",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  fluency: "Fluency",
  simulation_meeting: "Meeting simulation",
};

/**
 * Each template is a real speaking task — not a self-referential "Auravo helps you practice…" stub. The week-plan
 * generator picks 2–3 templates per day, biased toward the learner's weakest dimensions and stated goal, and seeded
 * by `(userId, isoWeek, regenerateNonce)` so refreshes are stable but a "Regenerate" action reshuffles.
 *
 * Adding a template is a no-config change: just append. Aim for one new prompt subject per template (avoid copying an
 * existing scenario with a swapped noun) so the rotation never feels samey.
 */
export type ExerciseTemplate = {
  /** Stable ID — used by /api/practice/exercise for prompt look-up. Never change after release. */
  id: string;
  /** Card title learners see (5–8 words, no marketing voice). */
  title: string;
  /** Single-line context shown under the title. */
  subtitle: string;
  /** What the learner should do, written like a coach giving direction. 1–3 sentences. */
  instructions: string;
  /** The actual passage / question / scenario the learner speaks about. This is the substantive content. */
  promptText: string;
  /** What we're listening for — surfaced in the runner so the learner knows the rubric. */
  coachingGoal: string;
  /** Suggested target recording length (seconds) for the exercise card. */
  targetDurationSec: number;
  /** Primary dimension this exercise stresses. The picker prioritises weak-dim matches. */
  focus: DimensionKey;
  /** Themed category — used to label the day in the learning-path week view. */
  category: ExerciseCategory;
  /** Beginner / intermediate / advanced — the picker chooses based on baseline average. */
  difficulty: ExerciseDifficulty;
  /** Goals where this template is preferred. Empty array == matches any goal. */
  goalAffinity: PracticeGoalId[];
};

const T: ExerciseTemplate[] = [
  // ────────────────────────────────────────────────────────────────────────────
  // Filler control — conversational responses with structured pauses
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "filler-three-beat-status",
    title: "Status update in three beats",
    subtitle: "Replace fillers with deliberate pauses",
    instructions:
      "Reply to the prompt below in 45–60 seconds. Use a beat 1 / beat 2 / beat 3 structure. When you feel an 'um' or 'like' arriving, pause silently instead — silence reads as confidence.",
    promptText:
      "Your manager just pinged: 'Quick status on the migration?' Reply out loud: (1) where we are right now, (2) what's blocking us, (3) the single next step you'll take today.",
    coachingGoal: "Cut filler words below 4 per minute. Pauses should land on transitions, not mid-sentence.",
    targetDurationSec: 55,
    focus: "filler_words",
    category: "filler_control",
    difficulty: "intermediate",
    goalAffinity: ["professional", "general"],
  },
  {
    id: "filler-opinion-handoff",
    title: "Two-minute opinion, zero 'likes'",
    subtitle: "Hold a position without verbal hedging",
    instructions:
      "Pick the more controversial side of the prompt and defend it for 60–90 seconds. Banned words: 'like,' 'you know,' 'kind of.' When you hesitate, breathe and continue.",
    promptText:
      "Should companies require everyone back in the office at least three days a week? State your position in the first sentence, give two reasons grounded in trade-offs (not slogans), and end with how you'd handle the strongest counter-argument.",
    coachingGoal: "No hedging fillers. Each reason should land in one full sentence.",
    targetDurationSec: 75,
    focus: "filler_words",
    category: "filler_control",
    difficulty: "intermediate",
    goalAffinity: ["professional", "academic", "general"],
  },
  {
    id: "filler-meeting-wrap",
    title: "Wrap a meeting in 30 seconds",
    subtitle: "Tight close-out with no throat-clearing",
    instructions:
      "Imagine the last 30 seconds of a meeting you led. Summarise three decisions + one owner + one date. Do not start with 'so,' 'um,' or 'okay so.'",
    promptText:
      "We agreed on: switching the vendor by Friday, postponing the redesign to Q3, and shipping the analytics fix this sprint. Owners are unclear. Land the wrap-up with crisp ownership and the next checkpoint.",
    coachingGoal: "Open with a verb, not a filler. End with a date.",
    targetDurationSec: 45,
    focus: "filler_words",
    category: "filler_control",
    difficulty: "beginner",
    goalAffinity: ["professional", "general"],
  },
  {
    id: "filler-yesterday-recap",
    title: "Describe yesterday — no 'um'",
    subtitle: "Everyday speech, zero filler crutches",
    instructions:
      "Talk about what you actually did yesterday for 45 seconds. Every time you feel 'um' or 'so' coming, pause for one beat instead. Keep going — don't restart sentences.",
    promptText:
      "Walk through yesterday in three chapters: morning, work block, evening. Each chapter is roughly 15 seconds. Aim for plain verbs and concrete nouns.",
    coachingGoal: "Pause count up, filler count down. Sentences should land cleanly.",
    targetDurationSec: 45,
    focus: "filler_words",
    category: "filler_control",
    difficulty: "beginner",
    goalAffinity: ["general", "professional", "academic"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Interview practice — behavioural STAR-style answers
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "interview-star-led-without-authority",
    title: "Time you led without authority",
    subtitle: "Behavioural answer in STAR shape",
    instructions:
      "Use STAR (Situation, Task, Action, Result) explicitly. Keep Situation under 15 seconds; spend most of the time on Action. End with a measurable Result, even if approximate.",
    promptText:
      "Tell me about a time you needed to influence a decision without being anyone's manager. What was the situation, what did you actually do, and what changed as a result?",
    coachingGoal:
      "Verbs in the Action section should be specific ('I rewrote,' 'I brokered,' 'I shipped' — not 'I helped' or 'I was involved').",
    targetDurationSec: 90,
    focus: "vocabulary",
    category: "interview",
    difficulty: "intermediate",
    goalAffinity: ["interview", "professional"],
  },
  {
    id: "interview-star-disagree-manager",
    title: "Time you disagreed with a manager",
    subtitle: "High-stakes behavioural answer",
    instructions:
      "STAR shape. Be specific about how you raised the disagreement — channel, language, who else was in the room. Avoid making your manager look bad.",
    promptText:
      "Walk me through a time you disagreed with a decision your manager made. How did you raise it, what did you propose instead, and what was the outcome — even if you didn't get your way?",
    coachingGoal:
      "Action verbs should show maturity ('I framed it as,' 'I brought data showing'). Result should include what you learned.",
    targetDurationSec: 90,
    focus: "fluency",
    category: "interview",
    difficulty: "advanced",
    goalAffinity: ["interview", "professional"],
  },
  {
    id: "interview-star-changed-mind",
    title: "Time data changed your mind",
    subtitle: "Self-aware behavioural answer",
    instructions:
      "Tell the story of a strong belief you held that evidence later flipped. Be honest about how the belief got there. End with what you do differently now.",
    promptText:
      "Describe a time when new information made you change your mind about an important call. What did you originally believe, what changed it, and how did you communicate the reversal?",
    coachingGoal: "Avoid hedging ('maybe,' 'kind of'). State the original belief in one sentence before the pivot.",
    targetDurationSec: 80,
    focus: "filler_words",
    category: "interview",
    difficulty: "intermediate",
    goalAffinity: ["interview", "academic", "professional"],
  },
  {
    id: "interview-star-broken-system",
    title: "Project you'd do differently",
    subtitle: "Retrospective behavioural answer",
    instructions:
      "Pick a real project that ended messily. STAR shape, but the Result is replaced with 'what I'd change.' Don't blame others — talk about your decisions.",
    promptText:
      "Walk me through a project that didn't land the way you wanted. What did you ship, what fell short, and what would you do differently if you started it again next quarter?",
    coachingGoal: "Concrete nouns, not abstractions ('alignment,' 'synergy' are red flags).",
    targetDurationSec: 90,
    focus: "vocabulary",
    category: "interview",
    difficulty: "intermediate",
    goalAffinity: ["interview", "professional"],
  },
  {
    id: "interview-strength-precise",
    title: "Your biggest strength — precisely",
    subtitle: "Specific verb, single example",
    instructions:
      "Banned opener: 'I am good at…' Replace with one specific verb ('I diagnose,' 'I unblock,' 'I translate between'). Back it up with one short example from the last six months.",
    promptText:
      "If you had to name one professional strength that compounds across roles, what is it, what does it look like in practice, and when did you last use it to change an outcome?",
    coachingGoal: "Strength must be a verb-shaped claim, not an adjective list.",
    targetDurationSec: 60,
    focus: "vocabulary",
    category: "interview",
    difficulty: "beginner",
    goalAffinity: ["interview", "professional", "general"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Client call — realistic business scenarios
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "client-discovery-skeptical-cfo",
    title: "Discovery call with a skeptical CFO",
    subtitle: "Open without overselling",
    instructions:
      "You have 60–90 seconds to set up a discovery call. Acknowledge their time pressure, state why you're worth the next 25 minutes, and offer them an out if it's not relevant.",
    promptText:
      "You're opening a discovery call with a CFO who agreed to 30 minutes but is clearly busy. They've used three competing tools before. Open the call.",
    coachingGoal: "Sentences should be short. No 'circling back,' 'synergies,' or 'unlocking value.'",
    targetDurationSec: 75,
    focus: "fluency",
    category: "client_call",
    difficulty: "advanced",
    goalAffinity: ["professional"],
  },
  {
    id: "client-renewal-budget-pushback",
    title: "Renewal call with budget pushback",
    subtitle: "Hold price, hold the relationship",
    instructions:
      "The customer wants a 20% discount or they'll churn. Respond out loud: anchor on value, name the floor you can move to (if any), and propose the next step.",
    promptText:
      "Your champion says: 'Finance is asking us to renegotiate. We can do 20% less or we walk.' Reply in 60–90 seconds.",
    coachingGoal: "Tone: collaborative, not defensive. Avoid filler hedges; pause where you'd normally say 'um.'",
    targetDurationSec: 80,
    focus: "fluency",
    category: "client_call",
    difficulty: "advanced",
    goalAffinity: ["professional"],
  },
  {
    id: "client-onboarding-non-technical",
    title: "Onboarding a non-technical stakeholder",
    subtitle: "Translate without talking down",
    instructions:
      "Explain how the integration works to someone who is brilliant in their domain but has never read a webhook payload. Use one analogy, two specifics, and a checkpoint question.",
    promptText:
      "You're onboarding the head of finance at a mid-market client. They need to understand how data syncs from their ERP into your tool, but they don't care about the engineering — only what it means for their team's workflow. Walk them through it.",
    coachingGoal: "Replace jargon with a working analogy. Check for understanding without being patronising.",
    targetDurationSec: 90,
    focus: "vocabulary",
    category: "client_call",
    difficulty: "intermediate",
    goalAffinity: ["professional"],
  },
  {
    id: "client-qbr-opening",
    title: "QBR opening with a newly-promoted champion",
    subtitle: "Adjust to their new audience",
    instructions:
      "Your champion just got promoted and is bringing two new leaders to the QBR. Open the meeting in 60 seconds: re-introduce the relationship, congratulate without grovelling, and set the agenda for them.",
    promptText:
      "Open a 30-minute quarterly business review. Your champion just became VP and invited two new directors who have not used your product. Start the meeting.",
    coachingGoal: "Greeting under 10 seconds. Agenda framed around the new attendees, not your roadmap.",
    targetDurationSec: 60,
    focus: "fluency",
    category: "client_call",
    difficulty: "intermediate",
    goalAffinity: ["professional"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Pronunciation — hard combinations, articulation drills
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "pronunciation-consonant-clusters",
    title: "Hard consonant clusters",
    subtitle: "Articulation under speed",
    instructions:
      "Say each cluster three times: slow, medium, conversational. Don't drop the final consonant. Repeat the whole list twice.",
    promptText:
      "sixth, twelfths, strengths, lengths, depths, crisp, asks, texts, glimpsed, prompts, scripts, sculpts, brisk.",
    coachingGoal: "Final '-s,' '-th,' '-ts' must remain audible at conversational speed.",
    targetDurationSec: 45,
    focus: "pronunciation",
    category: "pronunciation",
    difficulty: "intermediate",
    goalAffinity: ["general", "professional", "academic", "interview"],
  },
  {
    id: "pronunciation-multisyllabic-formal",
    title: "Multisyllabic professional words",
    subtitle: "Stress on the right syllable",
    instructions:
      "Read each word, then immediately use it in one sentence. Watch the primary stress — say it back if you mis-stressed.",
    promptText:
      "responsibility, infrastructure, prioritisation, vulnerability, recommendation, demonstrably, methodology, communication, unequivocally, sophisticated, particularly, organisational.",
    coachingGoal: "Primary stress on the correct syllable. Vowel reduction should sound natural, not clipped.",
    targetDurationSec: 60,
    focus: "pronunciation",
    category: "pronunciation",
    difficulty: "advanced",
    goalAffinity: ["professional", "academic"],
  },
  {
    id: "pronunciation-vowel-pairs",
    title: "Tricky vowel pairs",
    subtitle: "Ship vs sheep, fill vs feel",
    instructions:
      "Say each pair twice, then drop both words into a single sentence. Listen for the short/long contrast.",
    promptText:
      "ship / sheep · live / leave · pull / pool · full / fool · bit / beat · fill / feel · pitch / peach. Then: 'I'll leave the ship at the pool — the captain's pitch was full of beats.'",
    coachingGoal: "Short vowels should stay short. Long vowels should hold their full length.",
    targetDurationSec: 50,
    focus: "pronunciation",
    category: "pronunciation",
    difficulty: "beginner",
    goalAffinity: ["general", "academic", "interview"],
  },
  {
    id: "pronunciation-th-and-r",
    title: "'Th' and 'r' under load",
    subtitle: "Two sounds non-native speakers most often soften",
    instructions:
      "Read the passage once slowly, once at natural pace. Hold the 'th' (tongue light against the teeth) and roll the 'r' lightly, not heavily.",
    promptText:
      "Three thousand researchers gathered through the third quarter to thoroughly review three theories. The methodology, the throughput, and the theory of restructuring all required rather rigorous rehearsal.",
    coachingGoal: "Voiced 'th' (this, these) and unvoiced 'th' (think, three) should be distinct.",
    targetDurationSec: 55,
    focus: "pronunciation",
    category: "pronunciation",
    difficulty: "intermediate",
    goalAffinity: ["general", "professional", "academic"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Pacing — timed conversational paragraphs
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "pacing-conversational-read-tech",
    title: "Read aloud at conversational pace",
    subtitle: "Aim for ~140 words per minute",
    instructions:
      "Read the passage twice. First pass: deliberate. Second pass: a friend across a kitchen table. Mark a beat (silent pause) at every '//'.",
    promptText:
      "The fastest teams I've worked with share one trait // they treat their calendar like a small budget. They protect two hours of deep work each morning // and they leave a buffer between meetings instead of stacking them back to back. // Productivity, in the end, is less about willpower // and more about defending the hours where good work actually happens.",
    coachingGoal: "Words per minute within 130–150. Pauses on '//' should be audible but short.",
    targetDurationSec: 60,
    focus: "pacing",
    category: "pacing",
    difficulty: "intermediate",
    goalAffinity: ["professional", "general", "academic"],
  },
  {
    id: "pacing-pause-for-emphasis",
    title: "Vary pace for emphasis",
    subtitle: "Slow down where it matters",
    instructions:
      "Read the passage. Speed up through the setup, slow down for the underlined ideas, and land the final sentence at half speed. The point is contrast, not slowness.",
    promptText:
      "There were three options on the table, and only one was honest. The first was comfortable. The second was profitable. The third — and this is the one we picked — was the one we'd be proud of in five years.",
    coachingGoal:
      "Pace should drop on 'and this is the one we picked.' Last sentence should land slower than the rest of the passage.",
    targetDurationSec: 45,
    focus: "pacing",
    category: "pacing",
    difficulty: "intermediate",
    goalAffinity: ["professional", "general"],
  },
  {
    id: "pacing-deliberate-slowdown",
    title: "Slow narrative read",
    subtitle: "Anchor your default pace",
    instructions:
      "Aim for 50 seconds even. If you finish in 35, you went too fast. Read it once. Then read it again at the same pace, eyes off the screen as much as possible.",
    promptText:
      "When the ocean currents shift, the air shifts with them — sometimes within hours, more often across whole seasons. Coastal cities feel it first: warmer evenings, rain that arrives at the wrong time of year, fishermen returning with smaller catches. The change has been measured for decades, but the people who live closest to the sea read it differently. They notice the patterns before the satellites do.",
    coachingGoal: "Words per minute between 110–130. Sentence-final pauses should be visible.",
    targetDurationSec: 55,
    focus: "pacing",
    category: "pacing",
    difficulty: "beginner",
    goalAffinity: ["general", "academic"],
  },
  {
    id: "pacing-speed-control",
    title: "Speed control under instruction",
    subtitle: "Three speeds, one passage",
    instructions:
      "Read the passage three times: (1) deliberately slow, (2) natural conversational, (3) a little faster than natural — but still clear. Each pass should sound noticeably different.",
    promptText:
      "Most ideas die in the gap between meeting and follow-up. The person who writes it down before they leave the room is the person who ships. Everyone else is just talking.",
    coachingGoal: "Each pass should differ by at least 20 wpm. Articulation must hold even on the fast pass.",
    targetDurationSec: 50,
    focus: "pacing",
    category: "pacing",
    difficulty: "advanced",
    goalAffinity: ["professional", "interview"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Confidence — persuasive speaking prompts
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "confidence-recruit-a-friend",
    title: "Recruit a friend in 90 seconds",
    subtitle: "Persuasive pitch with conviction",
    instructions:
      "A capable friend is on the fence about joining your team. You have 90 seconds. Lead with the strongest reason. Avoid hedging. End with a clear ask.",
    promptText:
      "Pitch your current team (or a team you have worked on) to a friend who has a competing offer. Lead with the strongest reason in the first 10 seconds, then give one concrete story, then close with the specific next step you want them to take.",
    coachingGoal: "Sentences should be short. Avoid 'I think,' 'maybe,' 'kind of.' Ask for the close at the end.",
    targetDurationSec: 75,
    focus: "fluency",
    category: "confidence",
    difficulty: "intermediate",
    goalAffinity: ["professional", "interview", "general"],
  },
  {
    id: "confidence-defend-position",
    title: "Defend an unpopular call",
    subtitle: "Conviction without aggression",
    instructions:
      "Argue for a decision that gets pushback. Be calm and direct. Banned phrases: 'I just feel,' 'in my humble opinion,' 'sorry, but.'",
    promptText:
      "You decided to ship a product without a feature most of your users say they want. Defend the call to a room of stakeholders who disagree. State the decision, the trade-off you made, and what would change your mind.",
    coachingGoal: "Tone steady, pace measured. The phrase 'would change my mind' should land at the end.",
    targetDurationSec: 90,
    focus: "fluency",
    category: "confidence",
    difficulty: "advanced",
    goalAffinity: ["professional", "interview"],
  },
  {
    id: "confidence-elevator-pitch",
    title: "30-second elevator pitch",
    subtitle: "What you do, why it matters, what's next",
    instructions:
      "Stand up. Imagine the elevator door just opened and someone said 'so what do you do?' You have 30 seconds. One hook, two specifics, one signal of momentum.",
    promptText:
      "Introduce yourself and what you're working on right now. Lead with a hook that is not your job title. Give two concrete specifics. End with what you're trying to make happen next.",
    coachingGoal: "First sentence should not be 'I'm a [job title].' Last sentence should be forward-looking.",
    targetDurationSec: 40,
    focus: "fluency",
    category: "confidence",
    difficulty: "beginner",
    goalAffinity: ["professional", "interview", "general"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Grammar — sentence restructuring / correction speaking tasks
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "grammar-active-voice-restructure",
    title: "Restate in active voice",
    subtitle: "Move the verb to the front of the action",
    instructions:
      "Read each sentence below silently. Then say it out loud in clean active voice. The actor should be the grammatical subject. Do not skip any.",
    promptText:
      "The decision was made by the committee on Tuesday. The proposal will be reviewed by finance next week. Mistakes were made on the rollout. The customers were notified by support. The bug was introduced two sprints ago by an unrelated change.",
    coachingGoal: "Every sentence should start with the actor (the committee, finance, we, support, the team).",
    targetDurationSec: 60,
    focus: "grammar",
    category: "grammar",
    difficulty: "intermediate",
    goalAffinity: ["professional", "academic"],
  },
  {
    id: "grammar-combine-clauses",
    title: "Combine short clauses",
    subtitle: "Sound natural without choppiness",
    instructions:
      "Combine each cluster of short sentences into one fluid sentence. Use 'although,' 'because,' 'while,' or a relative clause where it helps. Speak the new sentence aloud.",
    promptText:
      "We launched the feature on Monday. Adoption was slow. The team wasn't surprised. They had warned the PM. // The customer asked for a refund. We checked the logs. The outage was real. We refunded immediately. // The candidate had strong references. Her interview was uneven. We made an offer anyway. She accepted.",
    coachingGoal:
      "Each three-sentence cluster should become one or two sentences with subordinate clauses. Tense should stay consistent.",
    targetDurationSec: 75,
    focus: "grammar",
    category: "grammar",
    difficulty: "advanced",
    goalAffinity: ["academic", "professional", "interview"],
  },
  {
    id: "grammar-tense-conversion",
    title: "Tense conversion under pressure",
    subtitle: "Re-tell, but past → present perfect",
    instructions:
      "Tell a short story (about a recent week at work or school) in three sentences, in the simple past. Pause. Then tell the same story in the present perfect ('I have…'). Same story, new tense.",
    promptText:
      "Start: 'Last week I…'. Three sentences in simple past. Then say: 'In the past week, I have…' and re-tell the same three points using present perfect ('I have shipped,' 'I have learned,' 'I have rebuilt').",
    coachingGoal: "No tense mixing inside a single version. Auxiliary verb 'have/has' must be clearly pronounced.",
    targetDurationSec: 60,
    focus: "grammar",
    category: "grammar",
    difficulty: "intermediate",
    goalAffinity: ["academic", "interview"],
  },
  {
    id: "grammar-because-although",
    title: "Use 'because' and 'although' deliberately",
    subtitle: "Add structure to opinions",
    instructions:
      "Answer the prompt in 60 seconds. Use 'because' at least twice and 'although' at least once. Each conjunction must introduce a real clause, not a fragment.",
    promptText:
      "Should companies publish all salaries internally? Take a side. Use 'because' to justify, and 'although' to grant the strongest point on the other side.",
    coachingGoal: "Complete clauses on both sides of 'because' and 'although.'",
    targetDurationSec: 60,
    focus: "grammar",
    category: "grammar",
    difficulty: "intermediate",
    goalAffinity: ["academic", "interview", "general"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Vocabulary — precise word choice
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "vocab-replace-thing-stuff",
    title: "Banned words: thing, stuff, good",
    subtitle: "Force precise nouns and adjectives",
    instructions:
      "Describe a process you know well in 60 seconds. Banned words: 'thing,' 'stuff,' 'good,' 'nice.' Every time you'd reach for one, replace it with a specific noun or verb.",
    promptText:
      "Walk through how you debug a problem at work or in a project. From the moment you notice something is off, all the way to the fix.",
    coachingGoal: "Specific nouns where you'd normally say 'thing.' Specific verbs where you'd normally say 'do.'",
    targetDurationSec: 60,
    focus: "vocabulary",
    category: "vocabulary",
    difficulty: "intermediate",
    goalAffinity: ["professional", "academic"],
  },
  {
    id: "vocab-synonym-ladder",
    title: "Synonym ladder for one verb",
    subtitle: "Three verbs, one idea",
    instructions:
      "Take the verb 'help.' Tell the same short story three times using three different, more specific verbs (e.g. 'unblocked,' 'coached,' 'rewrote'). Each retelling should change the meaning slightly.",
    promptText:
      "Tell a 30-second story about a time you helped someone at work. Then retell it twice, each time replacing 'help' with a sharper verb that changes the texture of what you did.",
    coachingGoal:
      "Each retelling should land a different shade of meaning. No two retellings should use the same primary verb.",
    targetDurationSec: 90,
    focus: "vocabulary",
    category: "vocabulary",
    difficulty: "advanced",
    goalAffinity: ["interview", "professional", "academic"],
  },
  {
    id: "vocab-describe-without-jargon",
    title: "Explain your work without jargon",
    subtitle: "For a smart 12-year-old",
    instructions:
      "Describe what you actually do at work or school to a smart 12-year-old in 60 seconds. No acronyms, no insider words, no 'leverage,' 'synergy,' 'optimise.' Use analogies if they help.",
    promptText:
      "Pretend a curious, articulate 12-year-old just asked: 'But what do you actually do all day?' Answer them.",
    coachingGoal: "Zero jargon. One analogy. Use concrete nouns from everyday life.",
    targetDurationSec: 65,
    focus: "vocabulary",
    category: "vocabulary",
    difficulty: "beginner",
    goalAffinity: ["general", "interview", "academic"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Fluency — flow between ideas
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "fluency-project-recap",
    title: "Recent project in one minute",
    subtitle: "Bridge ideas without restarting sentences",
    instructions:
      "Tell the story of one recent project. Start with the problem, walk through what you did, end with what changed. Do not restart sentences — if you fumble, keep going.",
    promptText:
      "Pick one project from the last three months. Describe the problem someone brought you, what you actually did about it, and what is different now because of your work.",
    coachingGoal: "Smooth transitions ('so,' 'after that,' 'which meant'). Don't repeat the opening clause.",
    targetDurationSec: 70,
    focus: "fluency",
    category: "fluency",
    difficulty: "intermediate",
    goalAffinity: ["interview", "professional", "academic", "general"],
  },
  {
    id: "fluency-stream-of-consciousness",
    title: "Free-form on a familiar topic",
    subtitle: "Talk continuously, no notes",
    instructions:
      "Pick something you know cold (a sport, a city you've lived in, a hobby). Talk about it for 75 seconds without pausing for more than two beats. The point is uninterrupted flow, not polish.",
    promptText:
      "Choose one of these and start: a city you have lived in, a sport you've played seriously, a book you've re-read, a hobby that has changed how you think.",
    coachingGoal: "No restarts. Pauses should be intentional, not 'um' substitutes.",
    targetDurationSec: 75,
    focus: "fluency",
    category: "fluency",
    difficulty: "beginner",
    goalAffinity: ["general", "interview"],
  },
  {
    id: "fluency-explain-chart",
    title: "Explain a chart to a teammate",
    subtitle: "Smooth narration of data",
    instructions:
      "Walk through the chart described below in 45–60 seconds. Use full sentences. Don't read the numbers — frame what they mean.",
    promptText:
      "A chart shows that customer retention improved from 71% to 83% over the past three quarters, mostly driven by a single product change. Explain the chart out loud to a teammate who hasn't seen it yet.",
    coachingGoal:
      "Open with the headline, not the axes. Bridge each number with a verb ('rose,' 'recovered,' 'held flat').",
    targetDurationSec: 55,
    focus: "fluency",
    category: "fluency",
    difficulty: "intermediate",
    goalAffinity: ["professional", "academic"],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Simulation meeting — voice rehearsal in meeting-shaped contexts
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "simulation-standup-update",
    title: "Stand-up update, no slides",
    subtitle: "Yesterday / today / blockers in 60 seconds",
    instructions:
      "Deliver a stand-up update covering yesterday, today, and blockers. Each block under 20 seconds. Don't say 'I worked on…'.",
    promptText:
      "Imagine your team's daily stand-up just started. Give your three-part update: what shipped or moved yesterday, what you're committing to today, and any blocker that needs another human.",
    coachingGoal:
      "Each block should start with a verb. Blockers must be specific ('waiting on X from Y by Z'), not vague.",
    targetDurationSec: 55,
    focus: "fluency",
    category: "simulation_meeting",
    difficulty: "beginner",
    goalAffinity: ["professional"],
  },
  {
    id: "simulation-leadership-1on1",
    title: "Leadership 1:1 — bringing up a hard thing",
    subtitle: "Open with intent, not preamble",
    instructions:
      "You are 30 seconds into a 1:1 with your skip-level. Bring up something difficult (workload, scope, a decision you disagree with). State the intent in the first sentence. No 'I just wanted to…' opener.",
    promptText:
      "It's a 1:1 with your skip-level manager. You want to raise a real concern that's been weighing on you. Open the topic and frame what you'd like out of the next ten minutes.",
    coachingGoal:
      "Open with the verb form: 'I want to talk about X, because Y, and I'd like Z out of this conversation.'",
    targetDurationSec: 60,
    focus: "filler_words",
    category: "simulation_meeting",
    difficulty: "advanced",
    goalAffinity: ["professional"],
  },
  {
    id: "simulation-panel-question",
    title: "Panel question under pressure",
    subtitle: "Mic just landed on you",
    instructions:
      "A panel moderator just turned the question to you. You have ~75 seconds. Acknowledge the question, give the actual answer, and end with one concrete handoff back to the panel.",
    promptText:
      "The moderator says: 'Curious to get your take — given the last six months, where do you see this industry heading next year, and what would change your mind?' Answer.",
    coachingGoal:
      "Acknowledgement under five seconds. Answer must include 'what would change my mind.' End with a handoff sentence.",
    targetDurationSec: 80,
    focus: "fluency",
    category: "simulation_meeting",
    difficulty: "advanced",
    goalAffinity: ["academic", "professional", "interview"],
  },
];

export const EXERCISE_LIBRARY: readonly ExerciseTemplate[] = T;

export function getExerciseById(id: string): ExerciseTemplate | undefined {
  return EXERCISE_LIBRARY.find((t) => t.id === id);
}

export function isPracticeGoalId(g: string | null | undefined): g is PracticeGoalId {
  return g === "interview" || g === "professional" || g === "academic" || g === "general";
}
