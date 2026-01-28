'use client';

import React, { useState, useEffect, useRef } from 'react';

const FADE_MS = 700;

const About = () => {
  const [showVideo, setShowVideo] = useState(false);
  const [videoFadedIn, setVideoFadedIn] = useState(false);
  const [videoFadingOut, setVideoFadingOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showVideo && !videoFadingOut) {
      const id = requestAnimationFrame(() => setVideoFadedIn(true));
      return () => cancelAnimationFrame(id);
    }
    if (!showVideo) {
      setVideoFadedIn(false);
      setVideoFadingOut(false);
    }
  }, [showVideo, videoFadingOut]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCardClick = () => {
    if (showVideo) {
      setVideoFadingOut(true);
      timeoutRef.current = setTimeout(() => {
        setShowVideo(false);
        setVideoFadingOut(false);
        timeoutRef.current = null;
      }, FADE_MS);
    } else {
      setShowVideo(true);
    }
  };

  const proofPoints = [
    "Trained voice coaches and expert facilitators",
    "Live workshops for placements, interviews, presentations, leadership",
    "Practice-driven curriculum and constructive feedback loops",
    "Confidence & presence—backed by measurable voice improvement",
  ];

  return (
    <section id="about" className="py-20 relative overflow-hidden bg-black">
      {/* Background decoration - left side only; right side stays black */}
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-gradient-to-r from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse-slow pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-l from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: "1.5s" }}></div>
      {/* Right half of section: solid black so no rectangle/glow around character */}
      <div className="absolute top-0 right-0 bottom-0 w-1/2 max-lg:w-full max-lg:left-0 bg-[#000000]" style={{ zIndex: 0 }} aria-hidden="true" />
      
      <div className="max-w-container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="order-2 lg:order-1 animate-slide-in-left relative z-10" style={{ background: '#000' }}>
            <h2 className="text-h1 text-neutral-100 mb-6 animate-fade-in-up">
              Expert Coaching,<br className="sm:hidden"/> <span className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">Built for Real Outcomes</span>
            </h2>
            <p className="text-body-lg text-neutral-300 mb-8 leading-relaxed animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              Elevate communication skills through Auravo’s premium workshops, led by certified voice coaches and expert facilitators. Our programs focus on practical learning and real-world scenarios for students and professionals—ensuring every session delivers confident, measurable growth.
            </p>

            <div className="space-y-4 mb-8 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
              {proofPoints.map((point, index) => (
                <div key={index} className="flex items-start gap-3 group hover:bg-neutral-900/50 p-4 rounded-lg border border-neutral-800/50 hover:border-neon-blue/30 transition-all duration-300 backdrop-blur-sm">
                  <div className="w-2 h-2 bg-neon-blue rounded-full mt-3 flex-shrink-0 group-hover:scale-150 group-hover:shadow-glow-blue transition-all duration-300"></div>
                  <p className="text-neutral-300 group-hover:text-neutral-100 transition-colors duration-300">{point}</p>
                </div>
              ))}
            </div>

            <a
              href="/book-workshop"
              className="inline-flex bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold px-8 py-4 rounded-lg hover:shadow-glow transition-all duration-300 transform hover:scale-105 animate-fade-in-up group overflow-hidden relative"
              style={{ animationDelay: "0.4s" }}
            >
              <span className="relative z-10">Book a Workshop</span>
              <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </a>
          </div>

          <div className="order-1 lg:order-2 animate-slide-in-right relative z-10 flex flex-col" style={{ background: '#000' }}>
            {/* Reserved slot above card - character fades in here so he never covers the card */}
            <div
              className="w-full flex justify-center items-center min-h-[200px] md:min-h-[260px] flex-shrink-0"
              style={{ background: '#000', boxShadow: 'none' }}
            >
              {(showVideo || videoFadingOut) && (
                <div
                  className="flex justify-center transition-opacity"
                  style={{
                    opacity: videoFadingOut ? 0 : videoFadedIn ? 1 : 0,
                    transitionDuration: `${FADE_MS}ms`,
                    transitionTimingFunction: 'ease-out',
                  }}
                >
                  <video
                    src="/voca-walking%20to-right.mp4"
                    autoPlay
                    muted
                    playsInline
                    className="max-h-[200px] md:max-h-[260px] w-auto object-contain outline-none border-0"
                    style={{ background: '#000', boxShadow: 'none' }}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>

            <div className="relative group w-full flex-shrink-0">
              {/* Card - click to show/hide video above; purple gradient kept as is */}
              <button
                type="button"
                onClick={handleCardClick}
                className="relative w-full text-left rounded-3xl border border-neutral-800/60 bg-neutral-900/40 backdrop-blur-md overflow-hidden shadow-glow-soft transition-all duration-500 hover:border-neon-blue/50 hover:shadow-glow cursor-pointer"
              >
                {/* Subtle gradient glow ring on hover */}
                <div className="pointer-events-none absolute -inset-1 rounded-[1.6rem] bg-gradient-to-br from-neon-blue/20 via-neon-purple/20 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity"></div>

                <div className="relative p-3">
                  {/* Neutral abstract placeholder illustration */}
                  <div className="relative rounded-2xl overflow-hidden h-[clamp(360px,40vh,460px)] flex items-center justify-center bg-gradient-to-br from-neon-blue/10 via-neon-purple/10 to-neutral-900/30">
                    {/* Abstract coaches/workshop illustration */}
                    <svg
                      viewBox="0 0 200 200"
                      width="160"
                      height="160"
                      className="w-48 h-48 object-contain"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <defs>
                        <radialGradient id="avatarBg" cx="50%" cy="55%" r="80%">
                          <stop offset="0%" stopColor="#6ec8fa" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#a259ff" stopOpacity="0.14" />
                        </radialGradient>
                      </defs>
                      {/* Conference table */}
                      <ellipse cx="100" cy="155" rx="74" ry="25" fill="#19192a" opacity="0.18"/>
                      {/* Central "coach" icon */}
                      <circle cx="100" cy="75" r="29" fill="url(#avatarBg)" />
                      <circle cx="100" cy="77" r="21" fill="#242746" />
                      {/* Left/right participants */}
                      <circle cx="54" cy="93" r="15" fill="#3fa2ff" />
                      <circle cx="146" cy="93" r="15" fill="#5be9b9" />
                      {/* Lower participants */}
                      <circle cx="75" cy="117" r="11" fill="#7080fa" />
                      <circle cx="125" cy="117" r="11" fill="#a17aff" />
                    </svg>
                    {/* Decorative depth gradients */}
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-neutral-950/20 to-transparent pointer-events-none"></div>
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-950/20 to-transparent pointer-events-none"></div>
                  </div>

                  {/* Minimal caption row */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="inline-flex flex-shrink items-center gap-2 px-3 py-1.5 rounded-full border border-neon-blue/30 bg-neutral-900/80 backdrop-blur-sm text-neutral-200 text-sm shadow-glow-soft">
                      <span className="inline-block h-2 w-2 rounded-full bg-neon-blue animate-pulse"></span>
                      Expert Coaches & Workshops
                    </div>
                    <span className="text-xs text-neutral-400">For Students & Professionals</span>
                  </div>
                </div>
              </button>

              {/* Subtle floating accents */}
              <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-neon-blue/30 blur-[1px] animate-float"></div>
              <div className="absolute -bottom-4 -left-4 h-8 w-8 rounded-full bg-neon-purple/30 blur-[1px] animate-float" style={{ animationDelay: "1s" }}></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;