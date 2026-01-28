'use client';
import React, { useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { sectionVariants, textVariants, backgroundVariants, viewportSettings } from "../../utils/motionVariants";

const Hero = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const play = () => {
      video.play().catch(() => {});
      // Slow down playback to 0.75x speed for smoother, more aesthetic effect
      video.playbackRate = 0.75;
    };
    
    // Ensure video is ready before playing
    const handleLoadedData = () => {
      play();
    };
    
    if (video.readyState >= 2) {
      // Video already loaded
      play();
    } else {
      video.addEventListener('loadeddata', handleLoadedData);
    }
    
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        play();
        video.playbackRate = 0.75;
      }
    };
    
    document.addEventListener("visibilitychange", onVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  return (
    <section className="overflow-hidden relative min-h-screen min-h-[100svh] flex items-center justify-center bg-black">
      {/* Background video — appears first */}
      <motion.div
        variants={backgroundVariants}
        initial="hidden"
        animate="visible"
        className="absolute inset-0 z-0"
      >
        <video
          ref={videoRef}
          src="/hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="hero-bg-video absolute inset-0 w-full h-full object-cover object-center"
          style={{ 
            pointerEvents: "none", 
            filter: "blur(15px)",
            transform: "scale(1.1)",
            minWidth: "100%",
            minHeight: "100%"
          }}
          aria-hidden
        />
        <style>{`
          .hero-bg-video::-webkit-media-controls,
          .hero-bg-video::-webkit-media-controls-panel,
          .hero-bg-video::-webkit-media-controls-play-button,
          .hero-bg-video::-webkit-media-controls-start-playback-button { display: none !important; }
        `}</style>
        {/* Dark overlay for text readability with subtle gradient */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/85 pointer-events-none"
          aria-hidden
        />
      </motion.div>
      <div className="relative z-10 w-full min-h-screen min-h-[100svh] flex flex-col items-center justify-center">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportSettings}
          className="flex flex-col items-center justify-center gap-6 text-center max-w-6xl mx-auto mt-20 md:mt-0 px-4 relative z-10"
        >
          <motion.h1 
            variants={textVariants}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-neutral-100 mb-4" 
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="bg-gradient-to-br from-neon-blue via-neon-purple to-neon-cyan bg-clip-text text-transparent animate-shimmer bg-[length:200%_auto] drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">
              Auravo
            </span>
          </motion.h1>
          
          <motion.p 
            variants={textVariants}
            className="text-xl md:text-2xl text-neutral-300 mb-4 font-medium max-w-4xl leading-relaxed"
          >
            Your Voice, Elevated.
          </motion.p>
          
          <motion.p 
            variants={textVariants}
            className="text-lg text-neutral-400 mb-12 max-w-3xl leading-relaxed"
          >
            High-performance voice and communication coaching for modern professionals.
          </motion.p>
          
          <motion.div 
            variants={textVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <a
              href="/voice-quiz"
              className="relative bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold px-8 py-4 rounded-lg transition-all duration-200 shadow-glow group inline-flex items-center justify-center gap-2 overflow-hidden hover:brightness-110"
            >
              <span className="relative z-10">Get Started</span>
              <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-blue opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </a>
            <a
              href="/book-workshop"
              className="border-2 border-neon-blue/50 text-neon-blue font-semibold px-8 py-4 rounded-lg transition-all duration-200 backdrop-blur-sm hover:bg-neon-blue/10 hover:border-neon-blue hover:brightness-110"
            >
              Book a Workshop
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;