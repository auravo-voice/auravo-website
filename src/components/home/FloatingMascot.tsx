'use client';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const FloatingMascot = ({ videoSrc = '/mascot-idle.mp4' }: { videoSrc?: string }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="relative pointer-events-none z-[50] flex items-center justify-center"
      initial={{ opacity: 1, scale: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.5 }}
    >
      <MascotContent
        prefersReducedMotion={!!prefersReducedMotion}
        size="w-40 h-40 md:w-52 md:h-52"
        videoSrc={videoSrc}
      />
    </motion.div>
  );
};

const MascotContent = ({
  prefersReducedMotion,
  size,
  videoSrc,
}: {
  prefersReducedMotion: boolean;
  size: string;
  videoSrc: string;
}) => {
  return (
    <>
      <motion.div
  className={`relative ${size} bg-black`}
  animate={
          prefersReducedMotion
            ? { y: 0, rotate: 0, scale: 1 }
            : {
                y: [0, -10, 0],
                rotate: [0, 2, 0, -2, 0],
                scale: [1, 1.03, 1],
              }
        }
        initial={{ opacity: 1, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.5 }
            : {
                y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      >
        <video
          src={videoSrc}
          className="w-full h-full object-contain"
          style={{ pointerEvents: 'none', display: 'block' }}
          autoPlay
          loop
          muted
          playsInline
          aria-label="Auravo mascot"
          onError={(e) => {
            console.error('Mascot video failed to load:', e);
          }}
        />
      </motion.div>
    </>
  );
};

export default FloatingMascot;
