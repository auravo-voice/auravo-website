'use client';
import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import FloatingMascot from './FloatingMascot';
import { backgroundVariants, textVariants, viewportSettings } from '../../utils/motionVariants';

const Mascot = () => {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.2, rootMargin: '-100px' }
    );

    const element = document.getElementById('mascot-section');
    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, []);

  return (
    <section id="mascot-section" className="py-20 relative overflow-visible bg-black">
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{
              duration: 1.2,
              ease: 'easeOut',
              delay: 0.3,
            }}
            className="max-w-container mx-auto px-6 relative z-10"
          >
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
            {/* Heading + text */}
            <div className="max-w-2xl text-center md:text-left">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{
                duration: 1,
                ease: 'easeOut',
                delay: 0.4,
              }}
              className="text-3xl md:text-4xl font-bold text-neutral-100 mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Voca
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{
                duration: 1,
                ease: 'easeOut',
                delay: 0.5,
              }}
              className="text-xl md:text-2xl text-neutral-300 font-medium leading-relaxed"
            >
              Your personal voice companion.{' '}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.8,
                  ease: 'easeOut',
                }}
                className="text-neon-blue"
              >
                Always listening.
              </motion.span>{' '}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 1.1,
                  ease: 'easeOut',
                }}
                className="text-neon-purple"
              >
                Always helping.
              </motion.span>
            </motion.p>
            </div>
            
            {/* Floating Mascot - fades in after text */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: 1,
                ease: 'easeOut',
                delay: 0.7,
              }}
              className="relative flex-shrink-0"
            >
            <FloatingMascot />
          </motion.div>
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Mascot;
