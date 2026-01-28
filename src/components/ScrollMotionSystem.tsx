'use client';
import { useEffect } from 'react';

/**
 * Luxury-tech scroll motion system
 * Manages background blur/opacity/noise based on scroll velocity and pause state
 */
const ScrollMotionSystem = () => {
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    let lastTime = Date.now();
    let scrollTimeout: NodeJS.Timeout | null = null;
    let pauseStartTime: number | null = null;
    let rafId: number | null = null;

    const updateScrollState = () => {
      const currentTime = Date.now();
      const currentScrollY = window.scrollY;
      const deltaTime = currentTime - lastTime;
      const deltaY = Math.abs(currentScrollY - lastScrollY);

      if (deltaTime > 0) {
        scrollVelocity = deltaY / deltaTime; // pixels per ms
      }

      lastScrollY = currentScrollY;
      lastTime = currentTime;

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Fast scrolling: soften/blur background
      if (scrollVelocity > 0.5) {
        document.documentElement.style.setProperty('--bg-blur', '2px');
        document.documentElement.style.setProperty('--bg-opacity', '0.85');
        document.documentElement.style.setProperty('--bg-noise', '0.3');
        pauseStartTime = null;
      }

      // Detect scroll stop
      scrollTimeout = setTimeout(() => {
        pauseStartTime = Date.now();

        // After 150-250ms pause: sharpen background
        setTimeout(() => {
          if (pauseStartTime && Date.now() - pauseStartTime >= 150) {
            document.documentElement.style.setProperty('--bg-blur', '0px');
            document.documentElement.style.setProperty('--bg-opacity', '1');
            document.documentElement.style.setProperty('--bg-noise', '0.4');

            // After ~600ms pause: reveal micro details
            setTimeout(() => {
              if (pauseStartTime && Date.now() - pauseStartTime >= 600) {
                document.documentElement.style.setProperty('--bg-noise', '0.5');
              }
            }, 350);
          }
        }, 150);
      }, 150);

      rafId = requestAnimationFrame(updateScrollState);
    };

    // Initialize CSS variables
    document.documentElement.style.setProperty('--bg-blur', '0px');
    document.documentElement.style.setProperty('--bg-opacity', '1');
    document.documentElement.style.setProperty('--bg-noise', '0.4');

    rafId = requestAnimationFrame(updateScrollState);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  return null;
};

export default ScrollMotionSystem;
