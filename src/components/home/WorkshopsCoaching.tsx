'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const WorkshopsCoaching = () => {
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const tracks = [
    {
      title: 'School Workshops',
      description: 'Build confident, expressive young speakers. Auravo\'s school workshops strengthen articulation, clarity, and presentation skills early — supported by personalised progress tracking through our app. Schools choose Auravo because it creates long-term communication growth that traditional curriculums miss.',
    },
    {
      title: 'College Programs',
      description: 'Give students an edge in interviews, presentations, and the professional world. Our sessions combine expert coaching with real-time voice analysis to help students improve fast and stand out. Colleges trust Auravo to bridge the gap between academic learning and real-world communication.',
    },
    {
      title: 'Corporate Solutions',
      description: 'Transform how teams communicate — from leadership presence to client interactions to internal collaboration. Auravo helps professionals speak with more clarity, confidence, and impact. Corporates choose us because our personalised insights and training drive measurable performance improvements.',
    },
    {
      title: 'One-on-One Coaching',
      description: 'For individuals who want deeply customised guidance. Our coaches work personally with you while the app tracks progress and highlights exactly where improvement is needed. This is the fastest and most tailored way to strengthen your communication.',
    },
  ];

  const benefits = [
    'Live, interactive sessions',
    'Virtual and on-site formats',
    'Measurable outcomes',
    'Inclusive, global reach',
  ];

  const transitionConfig = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.3, ease: 'easeOut' },
      };

  // Auto-cycle through tracks
  useEffect(() => {
    if (prefersReducedMotion || isPaused) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setSelectedTrack((prev) => (prev + 1) % tracks.length);
    }, 3500); // Change every 3.5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [prefersReducedMotion, isPaused, tracks.length]);

  const handleTrackSelect = (index: number) => {
    setSelectedTrack(index);
    setIsPaused(true);
    // Resume auto-cycling after 10 seconds of inactivity
    setTimeout(() => {
      setIsPaused(false);
    }, 10000);
  };

  return (
    <section className="py-16 md:py-20 bg-neutral-950 relative overflow-hidden fade-in-on-scroll">
      <div className="max-w-container mx-auto px-4 md:px-6">
        {/* Heading and Paragraph */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
            Workshops & Coaching
          </h2>
          <p className="text-lg md:text-xl text-neutral-300 max-w-3xl mx-auto">
            Interactive, expert-led programs for schools, colleges, and corporates created to foster clarity, calm, and confidence through modern AI-powered voice training.
          </p>
        </div>

        {/* Track Selector + Details UI */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 mb-12 md:mb-16">
          {/* Left Column: Track Selector */}
          <div 
            className="space-y-2"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {tracks.map((track, index) => (
              <button
                key={index}
                onClick={() => handleTrackSelect(index)}
                className={`w-full text-left px-6 py-4 rounded-lg border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${
                  selectedTrack === index
                    ? 'bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border-neon-blue/50 text-white font-semibold'
                    : 'bg-transparent border-neutral-800/60 text-neutral-300 hover:border-neon-blue/30 hover:text-white'
                }`}
                aria-pressed={selectedTrack === index}
                aria-label={`Select ${track.title}`}
              >
                <span className="text-lg md:text-xl">{track.title}</span>
              </button>
            ))}
          </div>

          {/* Right Column: Details Panel */}
          <div className="relative min-h-[200px] md:min-h-[240px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedTrack}
                {...transitionConfig}
                className="h-full p-8 md:p-10 rounded-lg border border-neutral-800/60 bg-neutral-900/50 backdrop-blur-sm"
              >
                <h3 className="text-2xl md:text-3xl font-semibold mb-4 bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
                  {tracks[selectedTrack].title}
                </h3>
                <p className="text-lg md:text-xl text-neutral-300 leading-relaxed">
                  {tracks[selectedTrack].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Benefits Chips */}
        <div className="mb-10 md:mb-12">
          <p className="text-sm md:text-base text-neutral-400 text-center mb-6">
            Included in every program
          </p>
          <div className="flex flex-wrap gap-3 md:gap-4 justify-center">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="px-4 md:px-6 py-2 md:py-3 rounded-full border border-neutral-800/60 bg-neutral-900/60 backdrop-blur-sm text-neutral-300 text-sm md:text-base"
              >
                {benefit}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <a
            href="/book-workshop"
            className="inline-block px-8 md:px-12 py-4 md:py-5 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold text-lg md:text-xl hover:shadow-glow transition-all duration-300 transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Bring Auravo to Your Institution
          </a>
        </div>
      </div>
    </section>
  );
};

export default WorkshopsCoaching;
