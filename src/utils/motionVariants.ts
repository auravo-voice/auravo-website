import type { Variants } from 'framer-motion';

/**
 * Luxury-tech motion variants
 * Consistent animation patterns across the site
 */

// Section container entrance
export const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: 'easeOut',
      staggerChildren: 0.12,
    },
  },
};

// Card/item entrance (with stagger support)
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay: i * 0.12,
      ease: 'easeOut',
    },
  }),
};

// Stagger container for child elements
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

// Text elements (headings, paragraphs)
export const textVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

// Background elements (appear first)
export const backgroundVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

// Subtle hover variants (no bounce/glow explosions)
export const subtleHover = {
  scale: 1.01,
  transition: { duration: 0.2, ease: 'easeOut' },
};

// Viewport settings for animations
export const viewportSettings = {
  once: true,
  margin: '-50px',
} as const;
