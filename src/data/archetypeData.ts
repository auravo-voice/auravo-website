/**
 * Voice Archetype Data
 * Complete profiles for all 4 voice archetypes
 */

export type ArchetypeName = 'Analyst' | 'Connector' | 'Leader' | 'Hidden Voice';

export interface Program {
  title: string;
  relevance: string;
  description: string;
}

export interface ArchetypeData {
  name: string;
  subtitle: string;
  emoji: string;
  description: string;
  traits: string[];
  challenges: string[];
  growthPath: string;
  color: string;
  programs: Program[];
}

export const archetypeData: Record<ArchetypeName, ArchetypeData> = {
  Analyst: {
    name: "The Analyst",
    subtitle: "The Clarity Archetype",
    emoji: "🎯",
    description: "You are the voice of precision, structure, and logic. Your communication is grounded in facts, clarity, and well-reasoned arguments. People trust your expertise and rely on you to cut through noise with sharp insights. However, your strength in logic can sometimes overshadow emotional connection, making you seem distant or overly critical.",
    traits: [
      "Precise and structured",
      "Data-driven communicator",
      "Logical and analytical",
      "Detail-oriented",
      "Credible and authoritative",
      "Clear and concise"
    ],
    challenges: [
      "Can come across as cold or detached",
      "May overvalue logic at the expense of empathy",
      "Struggle to connect emotionally with audiences",
      "May sound rigid or inflexible",
      "Can be perceived as overly critical"
    ],
    growthPath: "Your path forward is to integrate warmth into your clarity. Learn to lead with empathy while maintaining your analytical edge. Practice storytelling that bridges data with human experience. Develop vocal variety to express emotion without sacrificing precision.",
    color: "#3B82F6",
    programs: [
      {
        title: "The Vocal Awakening",
        relevance: "Perfect for adding emotional depth and presence to your logical delivery",
        description: "Transform from rehearsed precision to authentic, magnetic communication"
      },
      {
        title: "Speak to Rise",
        relevance: "Identify and release the blocks keeping your voice in 'logic-only' mode",
        description: "Personalized coaching to balance analytical strength with warmth"
      },
      {
        title: "The Aligned Communicator",
        relevance: "Ideal for leaders who need to inspire teams, not just inform them",
        description: "Custom coaching for executives seeking to blend authority with connection"
      }
    ]
  },
  Connector: {
    name: "The Connector",
    subtitle: "The Empathy Archetype",
    emoji: "💚",
    description: "You are the voice of warmth, empathy, and emotional intelligence. Your communication creates safety, builds trust, and makes people feel truly heard. You excel at reading the room and adapting your message to meet people where they are. However, your desire to please everyone can sometimes dilute your message or cause you to lose focus.",
    traits: [
      "Warm and relatable",
      "Emotionally intelligent",
      "Naturally empathetic",
      "Creates trust easily",
      "Adapts to audiences",
      "Makes people feel valued"
    ],
    challenges: [
      "Can over-explain or ramble",
      "May struggle with directness",
      "Tendency to prioritize harmony over honesty",
      "Can be inconsistent in messaging",
      "May avoid difficult conversations"
    ],
    growthPath: "Your path forward is to channel your empathy into clarity. Learn to be direct without losing your warmth. Practice setting boundaries in conversation and delivering concise messages. Strengthen your ability to say 'no' and stand firm in your truth while maintaining connection.",
    color: "#F97316",
    programs: [
      {
        title: "Speak to Rise",
        relevance: "Build confidence to be direct and assertive without losing your empathy",
        description: "Release the need to please and step into authentic, clear communication"
      },
      {
        title: "The Vocal Awakening",
        relevance: "Channel your warmth into commanding presence and focused delivery",
        description: "Live masterclass experience to strengthen your voice while honoring your heart"
      },
      {
        title: "Sacred Sound",
        relevance: "Deep healing work for empaths who absorb too much energy from others",
        description: "Energy alignment and vocal release practices to protect and empower your voice"
      }
    ]
  },
  Leader: {
    name: "The Leader",
    subtitle: "The Impact Archetype",
    emoji: "⚡",
    description: "You are the voice of command, inspiration, and decisive action. Your communication naturally draws people in and moves them to act. You speak with conviction, paint compelling visions, and aren't afraid to take bold stands. However, your intensity can sometimes overwhelm or intimidate others, creating distance instead of connection.",
    traits: [
      "Commanding and confident",
      "Naturally inspiring",
      "Decisive and direct",
      "Vision-driven",
      "Magnetic presence",
      "Action-oriented"
    ],
    challenges: [
      "Can be too direct or blunt",
      "May intimidate others unintentionally",
      "Struggle with active listening",
      "Can dominate conversations",
      "May come across as overwhelming"
    ],
    growthPath: "Your path forward is to balance power with presence. Learn to listen as powerfully as you speak. Practice slowing down to create space for others. Develop the art of invitation rather than declaration. Soften your delivery without diluting your impact.",
    color: "#8B5CF6",
    programs: [
      {
        title: "The Aligned Communicator",
        relevance: "Perfect for leaders who want to inspire without intimidating",
        description: "Custom coaching to balance commanding presence with approachability"
      },
      {
        title: "The Vocal Awakening",
        relevance: "Refine your natural magnetism and learn to lead with both strength and heart",
        description: "High-impact masterclass to elevate already strong communication skills"
      },
      {
        title: "The TEDx Experience",
        relevance: "Learn from world-class speakers how to channel intensity into unforgettable impact",
        description: "Access to magnetic communicators who master the art of powerful, balanced delivery"
      }
    ]
  },
  "Hidden Voice": {
    name: "The Hidden Voice",
    subtitle: "The Potential Archetype",
    emoji: "🌱",
    description: "You are the voice of depth, sensitivity, and profound insight. Your communication is thoughtful, nuanced, and rich with meaning—when you allow yourself to be heard. You see what others miss and feel things deeply, but hesitation and self-doubt often keep your brilliance hidden. Your greatest challenge is not your voice itself, but your willingness to use it.",
    traits: [
      "Deeply thoughtful",
      "Highly perceptive",
      "Sensitive and intuitive",
      "Reflective and introspective",
      "Rich inner world",
      "Authentic when safe"
    ],
    challenges: [
      "Hold back in conversations",
      "Underestimate your own value",
      "Struggle with self-doubt",
      "Avoid high-stakes speaking",
      "May be too soft-spoken",
      "Internalize criticism heavily"
    ],
    growthPath: "Your path forward is to claim your voice as your birthright. Build confidence through small, safe wins and gradually expand your comfort zone. Practice speaking before you feel 'ready.' Learn that your voice doesn't need to be perfect to be powerful. Your depth is a gift—the world needs to hear it.",
    color: "#10B981",
    programs: [
      {
        title: "Speak to Rise",
        relevance: "THE program for you—designed specifically to unlock hidden voices",
        description: "Deeply personalized sessions to release blocks and build unshakeable confidence"
      },
      {
        title: "Voice of a Rising Star",
        relevance: "If you're a young leader, start building vocal confidence early",
        description: "Curated programs for students and teens to own their voice before self-doubt solidifies"
      },
      {
        title: "Sacred Sound",
        relevance: "Healing-focused immersion for deep inner work and vocal liberation",
        description: "Retreats combining vocal release with meditation and energy alignment"
      },
      {
        title: "The Vocal Awakening",
        relevance: "When you're ready to step into presence, this masterclass will transform you",
        description: "Live experience to unlock your authentic, magnetic voice and commanding presence"
      }
    ]
  }
};

/**
 * Get archetype data by name
 * @param archetypeName - Name of the archetype
 * @returns Archetype data object or null if not found
 */
export const getArchetypeData = (archetypeName: string): ArchetypeData | null => {
  return archetypeData[archetypeName as ArchetypeName] || null;
};

/**
 * Get all archetype names
 * @returns Array of archetype names
 */
export const getAllArchetypeNames = (): ArchetypeName[] => {
  return Object.keys(archetypeData) as ArchetypeName[];
};

