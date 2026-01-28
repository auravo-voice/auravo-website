'use client';
import React, { useRef } from 'react';
import { motion, useReducedMotion, useInView, useAnimation } from 'framer-motion';

const WhatIsAuravo = () => {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.25, once: false });
  const controls = useAnimation();

  const features = [
    {
      title: 'AI Voice Assessment',
      description: 'Discover your strengths instantly and receive actionable feedback, powered by calming AI.',
    },
    {
      title: 'Live Workshops',
      description: 'Interactive coaching for voice, clarity, and real-world confidence. Delivered online or on-site.',
    },
    {
      title: 'Built for Everyone',
      description: 'For students, graduates, and seasoned professionals. Anyone ready to elevate their voice in a noisy digital world.',
    },
  ];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.35,
      },
    },
  };

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 50,
      scale: 0.85,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 1.2,
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
      // Reset to hidden first, then animate to show for proper replay
      controls.set('hidden');
      setTimeout(() => {
        controls.start('show');
      }, 50);
    } else {
      // Reset to hidden when out of view
      controls.start('hidden');
    }
  }, [isInView, controls, prefersReducedMotion]);

  return (
    <section id="what-is-auravo" ref={ref} className="py-16 md:py-20 bg-white dark:bg-neutral-950 relative overflow-hidden fade-in-on-scroll">
      {/* Subtle background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-neon-purple/5 via-neon-blue/3 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl font-semibold mb-6 text-neutral-900 dark:text-white">
            What is Auravo?
          </h2>
          
          {/* Editorial intro text */}
          <div className="max-w-3xl mx-auto space-y-4 mb-12">
            <p className="text-lg sm:text-xl text-neutral-700 dark:text-neutral-300 leading-relaxed" style={{ lineHeight: '1.75' }}>
              Auravo is the calming, premium AI platform that empowers students and professionals to communicate confidently, wherever they're heard.
            </p>
            <p className="text-lg sm:text-xl text-neutral-700 dark:text-neutral-300 leading-relaxed" style={{ lineHeight: '1.75' }}>
              Utilizing advanced voice AI, we deliver simple assessments and immersive live workshops designed to foster authentic, clear, and calm self-expression for our future-focused world.
            </p>
          </div>

          {/* Subtle divider */}
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-neutral-300 dark:via-neutral-700 to-transparent mx-auto mb-12" />
        </div>

        {/* Feature cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={controls}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              className="group relative"
            >
              <div
                className="h-full border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl p-8 bg-white/30 dark:bg-neutral-900/30 backdrop-blur-sm hover:border-neon-blue/40 dark:hover:border-neon-blue/40 hover:bg-white/50 dark:hover:bg-neutral-900/50 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 transform hover:-translate-y-1"
                style={{
                  boxShadow: '0 0 0 rgba(59, 130, 246, 0)',
                }}
                onMouseEnter={(e) => {
                  if (!prefersReducedMotion) {
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.15), 0 0 40px rgba(147, 51, 234, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 rgba(59, 130, 246, 0)';
                }}
              >
                <h3 className="font-semibold text-xl mb-3 text-neon-blue dark:text-neon-blue group-hover:text-neon-blue-light dark:group-hover:text-neon-blue-light transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default WhatIsAuravo;
