'use client';
import React, { useRef } from 'react';
import { motion, useReducedMotion, useInView, useAnimation } from 'framer-motion';
import FloatingMascot from './FloatingMascot';

const AIVoiceAssessment = () => {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.25 });
  const controls = useAnimation();

  const features = [
    { title: 'Voice Clarity Score', description: 'See how clear and understandable your speech is.' },
    { title: 'Confidence Analysis', description: 'AI detects and quantifies vocal confidence and presence.' },
    { title: 'Pronunciation Feedback', description: 'Personalized feedback to help you sound crisp and articulate.' },
    { title: 'Emotion Tone Detection', description: 'Discover the emotional tone your audience perceives in your voice.' },
    { title: 'Personalized Improvement Plan', description: 'Actionable, AI-generated daily exercises just for you.' },
    { title: 'Progress Tracking', description: 'Monitor your journey and celebrate your calm, confident improvements.' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.18 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 35, scale: 0.9 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: 'easeOut' } },
  };

  React.useEffect(() => {
    if (prefersReducedMotion) {
      controls.set('show');
      return;
    }
    if (isInView) controls.start('show');
    else controls.start('hidden');
  }, [isInView, controls, prefersReducedMotion]);

  return (
    <section
      ref={ref}
      className="py-16 md:py-20 bg-white dark:bg-neutral-950 relative overflow-hidden border-t border-neutral-200/50 dark:border-neutral-800/50 fade-in-on-scroll"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-radial from-neon-blue/6 via-neon-purple/3 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-container mx-auto px-4 md:px-6 relative z-10">
        {/* Heading wrapper (relative so mascot can anchor here) */}
<div className="relative mb-12 md:mb-16">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-semibold mb-6 bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
              AI Voice Assessment
            </h2>

            <p
              className="text-lg md:text-xl text-neutral-700 dark:text-neutral-300 mb-12 max-w-2xl mx-auto leading-relaxed"
              style={{ lineHeight: '1.75' }}
            >
              Unlock a deeper understanding of how you sound. Our AI Voice Assessment offers detailed analysis and
              practical tips—instantly.
            </p>
          </div>

          {/* Mascot: right side, vertically centered to heading+subheading */}
          <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2">
            <FloatingMascot videoSrc="/mascot-assessment.mp4" />
          </div>
        </div>

        {/* Cards: centered block */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={controls}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto"
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={cardVariants as any} className="group relative">
              <div className="h-full relative border border-neutral-200/60 dark:border-neutral-800/60 rounded-lg p-6 md:p-8 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 hover:border-neon-blue/50 dark:hover:border-neon-blue/50 hover:brightness-105">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-cyan opacity-30 group-hover:opacity-60 transition-opacity duration-300 rounded-t-lg" />

                <div className="space-y-3 pt-2">
                  <h3 className="font-semibold text-xl md:text-2xl text-neutral-900 dark:text-neutral-100 group-hover:text-neutral-900 dark:group-hover:text-neutral-50 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default AIVoiceAssessment;
