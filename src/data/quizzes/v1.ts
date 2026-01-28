// Snapshot of quiz questions for version v1
// Copied from src/data/quizQuestions.js

export interface QuizOption {
  text: string;
  archetype: 'Analyst' | 'Connector' | 'Leader' | 'Hidden Voice';
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
}

export const quizV1: QuizQuestion[] = [
  {
    id: 1,
    question: "During a team meeting when someone presents an idea you disagree with, you typically:",
    options: [
      { text: "Ask clarifying questions and point out potential gaps in their logic", archetype: "Analyst" },
      { text: "Express enthusiasm first, then gently share concerns about how it might impact the team", archetype: "Connector" },
      { text: "Quickly state your counter-perspective and suggest a better direction", archetype: "Leader" },
      { text: "Stay quiet initially, processing internally before sharing thoughts later if asked", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 2,
    question: "When preparing for an important presentation, you focus most on:",
    options: [
      { text: "Structuring content with clear data points and logical flow", archetype: "Analyst" },
      { text: "Creating an emotional connection and understanding your audience's needs", archetype: "Connector" },
      { text: "Crafting a compelling opening and a powerful call to action", archetype: "Leader" },
      { text: "Rehearsing extensively to avoid mistakes and calm your nerves", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 3,
    question: "When receiving critical feedback about your communication style, you:",
    options: [
      { text: "Analyze it objectively and ask for specific examples to improve", archetype: "Analyst" },
      { text: "Feel it deeply, take time to process, then seek to understand the other person's feelings", archetype: "Connector" },
      { text: "Defend your approach if you believe in it, but adapt quickly if it serves your goals", archetype: "Leader" },
      { text: "Internalize it heavily and replay the conversation in your mind repeatedly", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 4,
    question: "In a networking event, your natural communication style is:",
    options: [
      { text: "Focused and purposeful—you prefer deep, meaningful one-on-one conversations", archetype: "Analyst" },
      { text: "Warm and relatable—you quickly find common ground and make people feel comfortable", archetype: "Connector" },
      { text: "Confident and magnetic—you naturally draw people in and command attention", archetype: "Leader" },
      { text: "Observant and reserved—you listen more than you speak and warm up slowly", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 5,
    question: "When you need to influence someone's decision, you:",
    options: [
      { text: "Present facts, data, and a well-reasoned argument", archetype: "Analyst" },
      { text: "Appeal to their emotions and show how it benefits everyone involved", archetype: "Connector" },
      { text: "Paint a vision and inspire them to see the bigger opportunity", archetype: "Leader" },
      { text: "Hesitate to push, preferring to share your view gently and hope they come around", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 6,
    question: "Your biggest struggle when speaking in high-stakes situations is:",
    options: [
      { text: "Coming across as too cold or detached, even when you care deeply", archetype: "Analyst" },
      { text: "Over-explaining or losing focus because you're trying to please everyone", archetype: "Connector" },
      { text: "Being too direct or overwhelming others with your intensity", archetype: "Leader" },
      { text: "Holding back your true thoughts and underestimating your own voice", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 7,
    question: "People describe your voice and presence as:",
    options: [
      { text: "Clear, precise, and authoritative", archetype: "Analyst" },
      { text: "Warm, expressive, and engaging", archetype: "Connector" },
      { text: "Powerful, commanding, and persuasive", archetype: "Leader" },
      { text: "Soft, thoughtful, and introspective", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 8,
    question: "When you disagree with a group decision, you:",
    options: [
      { text: "Speak up immediately with logic and evidence to challenge it", archetype: "Analyst" },
      { text: "Express concern in a diplomatic way, focusing on how it affects people", archetype: "Connector" },
      { text: "Assert your viewpoint firmly and rally others to reconsider", archetype: "Leader" },
      { text: "Go along with it outwardly but feel frustrated internally", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 9,
    question: "Your ideal communication environment is one where:",
    options: [
      { text: "Ideas are debated rigorously and decisions are made based on merit", archetype: "Analyst" },
      { text: "Everyone feels heard, valued, and emotionally safe to share", archetype: "Connector" },
      { text: "There's clear direction, decisive leadership, and bold action", archetype: "Leader" },
      { text: "People are patient, thoughtful, and no one is put on the spot", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 10,
    question: "When telling a story, you naturally emphasize:",
    options: [
      { text: "The sequence of events, facts, and lessons learned", archetype: "Analyst" },
      { text: "The emotions involved and how people felt at each stage", archetype: "Connector" },
      { text: "The bold choices made and the dramatic outcome", archetype: "Leader" },
      { text: "The inner reflections and personal meaning behind it", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 11,
    question: "You feel most confident speaking when:",
    options: [
      { text: "You've thoroughly researched the topic and know your material inside out", archetype: "Analyst" },
      { text: "You feel emotionally connected to the subject and your audience", archetype: "Connector" },
      { text: "You're speaking about something you're passionate about and believe in strongly", archetype: "Leader" },
      { text: "You're in a safe, small setting with people who already trust you", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 12,
    question: "If someone interrupts you mid-sentence, you typically:",
    options: [
      { text: "Pause and redirect the conversation back to your point logically", archetype: "Analyst" },
      { text: "Let them speak first and adjust your tone to keep harmony", archetype: "Connector" },
      { text: "Firmly reclaim your space and finish your thought", archetype: "Leader" },
      { text: "Stop talking and may not circle back to finish your point", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 13,
    question: "Your communication superpower is:",
    options: [
      { text: "Breaking down complex ideas into clear, digestible insights", archetype: "Analyst" },
      { text: "Making people feel seen, understood, and emotionally supported", archetype: "Connector" },
      { text: "Inspiring action and galvanizing people around a shared vision", archetype: "Leader" },
      { text: "Seeing nuance and depth that others miss", archetype: "Hidden Voice" }
    ]
  },
  {
    id: 14,
    question: "What you most want to improve about your voice is:",
    options: [
      { text: "Adding warmth and emotional resonance without losing precision", archetype: "Analyst" },
      { text: "Being more concise and assertive without losing empathy", archetype: "Connector" },
      { text: "Balancing strength with approachability and active listening", archetype: "Leader" },
      { text: "Speaking up with confidence and owning your full presence", archetype: "Hidden Voice" }
    ]
  }
];

