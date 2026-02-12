'use client';
import React, { useRef } from 'react';
import { motion, useReducedMotion, useInView, useAnimation } from 'framer-motion';

const HowItWorks = () => {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.25 });
  const controls = useAnimation();

  const steps = [
    {
      number: 1,
      title: 'Attend a Workshop',
      description: 'Start with an immersive group or one-on-one session led by experts.',
    },
    {
      number: 2,
      title: 'Download the App',
      description: 'Install auravo and get instant access to your personal AI voice tools.',
    },
    {
      number: 3,
      title: 'Get Voice Score',
      description: 'Speak and receive instant, detailed analysis of your voice.',
    },
    {
      number: 4,
      title: 'Follow AI Feedback',
      description: 'Personalized daily practice and insights for continuous growth.',
    },
    {
      number: 5,
      title: 'Track Improvement',
      description: 'Enjoy measurable, calming progress—see your confidence and clarity grow.',
    },
    {
      number: 6,
      title: 'Earn Certificates',
      description: 'Prove your progress—receive official auravo certificates for new skills.',
    },
  ];

  // Animation variants - simple pop-up one by one
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.6,
      },
    },
  };

  const stepVariants = {
    hidden: {
      opacity: 0,
    },
    show: {
      opacity: 1,
      transition: {
        duration: 1,
        ease: 'easeOut',
      },
    },
  };

  // Control animations based on viewport
  React.useEffect(() => {
    if (prefersReducedMotion) {
      controls.set('show');
      return;
    }

    if (isInView) {
      controls.start('show');
    } else {
      controls.start('hidden');
    }
  }, [isInView, controls, prefersReducedMotion]);

  return (
    <section ref={ref} className="py-16 md:py-20 bg-auravo/10 relative overflow-hidden fade-in-on-scroll">
      {/* Subtle ambient gradient in unused right-side space */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-neon-blue/5 via-neon-purple/3 to-transparent pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-4 md:px-6 relative z-10">
        <h2 className="text-3xl md:text-4xl font-semibold text-center text-auravo mb-12 md:mb-16">
          How It Works
        </h2>

        <div className="relative">
          {/* Subtle gradient spine (replaces hard vertical line) */}
          <div className="absolute left-6 md:left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-neon-blue/20 via-neon-purple/30 to-neon-cyan/20 opacity-40" />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={controls}
            className="space-y-8 md:space-y-12"
          >
            {steps.map((step, index) => {
              const isPhaseBreak = index === 3; // Extra spacing after step 3
              
              return (
                <motion.div
                  key={step.number}
                  variants={stepVariants as any}
                  className={`relative flex items-start gap-6 md:gap-8 ${
                    isPhaseBreak ? 'mb-8 md:mb-12' : ''
                  }`}
                >
                  {/* Slight horizontal offset for alternating steps */}
                  <div className={`flex-shrink-0 ${index % 2 === 0 ? '' : 'md:ml-2'}`}>
                    {/* Numbered step marker */}
                    <div className="relative w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-neon-blue/80 to-neon-purple/80 shadow-[0_0_15px_rgba(59,130,246,0.2),0_0_30px_rgba(147,51,234,0.15)]">
                      <span className="text-white font-semibold text-lg md:text-xl">
                        {step.number}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <h3 className="block font-semibold text-lg md:text-xl mb-2 text-neutral-800 dark:text-neutral-200">
                      {step.title}
                    </h3>
                    <p className="block text-neutral-700 dark:text-neutral-300 text-base md:text-lg leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
