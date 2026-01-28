'use client';
import React from 'react';

const QUIZ_PATH = '/voice-quiz';

const FinalCTA = () => {
  const goToQuiz = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = QUIZ_PATH;
  };

  return (
    <section className="py-20 md:py-24 relative overflow-hidden bg-gradient-to-b from-neutral-950 via-black to-neutral-950 fade-in-on-scroll">
      {/* Subtle background decoration - matching site's glow style */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-neon-purple/10 via-neon-blue/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
      
      <div className="max-w-container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center max-w-2xl mx-auto">
          {/* Heading */}
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-100 leading-tight text-center mb-4 md:mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <span className="bg-gradient-to-br from-neon-blue via-neon-purple to-neon-cyan bg-clip-text text-transparent animate-shimmer bg-[length:200%_auto] drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">
              This is where practice begins.
            </span>
          </h2>

          {/* Subtext */}
          <p className="text-base md:text-lg text-neutral-300 leading-relaxed text-center mb-12 md:mb-16">
            Voca highlights the moments.
            <br />
            You train what matters.
          </p>

          {/* Practice Path */}
          <div className="w-full relative">
            {/* Step 01 - Quiz: explicit full-page navigation so the link always works */}
            <div className="relative mb-8 md:mb-12">
              <a
                href={QUIZ_PATH}
                onClick={goToQuiz}
                className="block group relative bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6 md:p-8 hover:border-neon-blue/50 hover:bg-neutral-900/70 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:brightness-105 cursor-pointer"
              >
                <div className="space-y-3">
                  <h3 className="text-lg md:text-xl font-semibold text-neon-blue group-hover:text-neon-blue-light transition-colors">
                    Take a Voice Quiz
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Identify your key voice patterns.
                  </p>
                </div>
              </a>
            </div>

            {/* Step 02 */}
            <div className="relative">
              <a
                href="/book-workshop?type=coach"
                className="block group relative bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6 md:p-8 hover:border-neon-purple/50 hover:bg-neutral-900/70 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:brightness-105"
              >
                <div className="space-y-3">
                  <h3 className="text-lg md:text-xl font-semibold text-neon-purple group-hover:text-neon-purple-light transition-colors">
                    Review Your Voice Live
                  </h3>
                  <p className="text-sm text-neutral-400">
                    A short, guided session with a coach.
                  </p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
