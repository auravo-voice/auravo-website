import React from 'react';

const Methodology = () => {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl" aria-hidden />
      <div className="absolute top-0 right-1/3 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-2xl" style={{ animationDelay: '2s' }} aria-hidden />

      <div className="max-w-container mx-auto px-6 relative z-10">
        <header className="text-center mb-8 md:mb-10 animate-fade-in-up">
          <h2 className="text-h1 text-neutral-100 mb-6 animate-fade-in-up">
            Proven Where It <span className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">Matters</span>
          </h2>
          <p className="text-body-lg text-neutral-400 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Real outcomes. Real use cases. Designed for real voices.
          </p>
        </header>

        {/* Left and Right Layout: Graphic on left, Use cases on right */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center mb-8 md:mb-10">
          {/* Left: Voice Ripple visual */}
          <div className="voice-ripple-container flex justify-center items-center min-h-[360px] sm:min-h-[450px] md:min-h-[500px] order-2 md:order-1">
            <div className="voice-ripple-wrapper relative w-full max-w-[min(90vw,520px)] md:max-w-full aspect-square shrink-0">
            <svg
              className="voice-ripple-svg absolute inset-0 w-full h-full overflow-visible"
              viewBox="0 0 400 400"
              aria-hidden
            >
              <defs>
                <linearGradient id="ripple-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#9333EA" />
                </linearGradient>
                <linearGradient id="ripple-grad-center" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22D3EE" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
                <linearGradient id="connector-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#9333EA" />
                </linearGradient>
              </defs>
              {/* Connectors: dot on ring; radial extension, L≈66; line ends just before label (Clarity standard) */}
              <g className="connector-clarity">
                <line x1="257.7" y1="152.2" x2="300" y2="102" className="connector-line" />
                <circle cx="257.7" cy="152.2" r="5" className="connector-dot" />
              </g>
              <g className="connector-consistency">
                <line x1="115.2" y1="284.8" x2="70" y2="331" className="connector-line" />
                <circle cx="115.2" cy="284.8" r="5" className="connector-dot" />
              </g>
              <g className="connector-presence">
                <line x1="316.6" y1="316.6" x2="363" y2="363" className="connector-line" />
                <circle cx="316.6" cy="316.6" r="5" className="connector-dot" />
              </g>
              <circle cx="200" cy="200" r="165" className="voice-ripple voice-ripple-3" />
              <circle cx="200" cy="200" r="120" className="voice-ripple voice-ripple-2" />
              <circle cx="200" cy="200" r="75" className="voice-ripple voice-ripple-1" />
              <circle cx="200" cy="200" r="40" className="voice-ripple voice-ripple-0" />
            </svg>

            {/* Center: Confidence + glow — fits inside inner ring (r=40) with padding */}
            <div className="voice-ripple-center absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="voice-ripple-center-inner flex flex-col items-center justify-center relative">
                <div className="voice-ripple-center-glow absolute inset-0 rounded-full" aria-hidden />
                <div className="voice-ripple-center-label relative z-10 flex flex-col items-center justify-center text-center px-2 py-1.5">
                  <span className="block voice-ripple-center-title text-neutral-200">Confidence</span>
                  <span className="block voice-ripple-center-subtitle mt-0.5">Internal stability</span>
                </div>
              </div>
            </div>

            {/* Labels: % relative to wrapper (= SVG). No transform — use inset+calc for Safari. */}
            <div
              className="voice-ripple-label voice-ripple-label-reveal clarity absolute text-left w-[22%] p-0 m-0 cursor-default"
              style={{
                left: 'calc(75% - 8px)',
                top: 'calc(25.5% - 2px)',
                animationDelay: '450ms',
              }}
            >
              <span className="block text-xs font-medium text-neutral-400/90 leading-tight">Clarity</span>
              <span className="block text-xs text-neutral-500/60 leading-tight">Measurable clarity</span>
            </div>
            <div
              className="voice-ripple-label voice-ripple-label-reveal consistency absolute text-right w-[20%] p-0 m-0 cursor-default"
              style={{
                right: '82.75%',
                top: '82.75%',
                animationDelay: '500ms',
              }}
            >
              <span className="block text-xs font-medium text-neutral-400/90 leading-tight">Consistency</span>
              <span className="block text-xs text-neutral-500/60 leading-tight">Reliable delivery</span>
            </div>
            <div
              className="voice-ripple-label voice-ripple-label-reveal presence absolute text-left w-[16%] p-0 m-0 cursor-default"
              style={{
                left: '90.75%',
                top: '90.75%',
                animationDelay: '550ms',
              }}
            >
              <span className="block text-xs font-medium text-neutral-400/90 leading-tight">Presence</span>
              <span className="block text-xs text-neutral-500/60 leading-tight">Calmer delivery</span>
            </div>
            </div>
          </div>

          {/* Right: Use cases — primary section: heading → divider → content */}
          <div className="voice-ripple-system-note flex flex-col items-center md:items-start max-w-xl mx-auto md:mx-0 animate-fade-in-up order-1 md:order-2" style={{ animationDelay: '0.3s' }}>
            <h3 className="voice-ripple-system-note-label">Who This Is Built For</h3>
            <div className="voice-ripple-system-note-divider" aria-hidden />
            <div className="voice-ripple-system-note-lines">
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-base mb-2 text-neutral-200">For Students</h4>
                  <p className="text-sm text-neutral-400 leading-relaxed">Sharpen clarity, confidence, and delivery for interviews, presentations, and competitions. Get instant feedback on voice, pacing, articulation, and overall presence so you stand out where it matters.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-2 text-neutral-200">For Institutions</h4>
                  <p className="text-sm text-neutral-400 leading-relaxed">Standardize communication quality across your student body with measurable benchmarks and consistent, automated feedback. Improve placement readiness, presentation skills, and overall confidence at scale.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-2 text-neutral-200">For Corporates</h4>
                  <p className="text-sm text-neutral-400 leading-relaxed">Equip teams with clearer communication, stronger presence, and more persuasive delivery. Reduce filler words, improve articulation in meetings, and help professionals speak with confidence and impact.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .voice-ripple-svg {
          transform-origin: center center;
          transform-box: fill-box;
        }
        .voice-ripple {
          fill: none;
          stroke: url(#ripple-grad);
          transform-origin: center center;
          transform-box: fill-box;
          transition: opacity 0.25s ease;
        }
        .voice-ripple-1 {
          stroke-width: 1.2;
          opacity: 0.42;
          animation: ripple-reveal-1 0.5s ease-out forwards, ripple-breathe-1 5s ease-in-out 0.6s infinite;
        }
        .voice-ripple-2 {
          stroke-width: 1;
          opacity: 0.35;
          animation: ripple-reveal-2 0.5s ease-out 0.05s forwards, ripple-breathe-2 5.5s ease-in-out 0.55s infinite;
        }
        .voice-ripple-3 {
          stroke-width: 0.85;
          opacity: 0.28;
          animation: ripple-reveal-3 0.5s ease-out 0.1s forwards, ripple-breathe-3 6s ease-in-out 0.6s infinite;
        }
        .voice-ripple-0 {
          stroke: url(#ripple-grad-center);
          stroke-width: 3;
          opacity: 0.7;
          animation: ripple-reveal-center 0.5s ease-out forwards, ripple-breathe-center 4.5s ease-in-out 0.5s infinite;
        }

        @keyframes ripple-reveal-1 {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 0.42; transform: scale(1); }
        }
        @keyframes ripple-reveal-2 {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 0.35; transform: scale(1); }
        }
        @keyframes ripple-reveal-3 {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 0.28; transform: scale(1); }
        }
        @keyframes ripple-reveal-center {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 0.7; transform: scale(1); }
        }
        @keyframes ripple-breathe-1 {
          0%, 100% { transform: scale(1); opacity: 0.42; }
          50% { transform: scale(1.03); opacity: 0.55; }
        }
        @keyframes ripple-breathe-2 {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.03); opacity: 0.48; }
        }
        @keyframes ripple-breathe-3 {
          0%, 100% { transform: scale(1); opacity: 0.28; }
          50% { transform: scale(1.03); opacity: 0.4; }
        }
        @keyframes ripple-breathe-center {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.03); opacity: 0.88; }
        }

        .connector-clarity, .connector-consistency, .connector-presence {
          opacity: 0;
          animation: connector-reveal 0.4s ease-out 0.4s forwards;
          transform-origin: center center;
          transform-box: fill-box;
        }
        .connector-line {
          stroke: url(#connector-grad);
          stroke-width: 1.25;
          stroke-opacity: 0.3;
          stroke-linecap: round;
          fill: none;
          transition: stroke-opacity 0.25s ease;
          transform-origin: center center;
          transform-box: fill-box;
        }
        .connector-dot {
          fill: url(#connector-grad);
          fill-opacity: 0.44;
          transition: fill-opacity 0.25s ease;
          transform-origin: center center;
          transform-box: fill-box;
        }

        .voice-ripple-container:has(.clarity:hover) .voice-ripple-1 { opacity: 0.62; }
        .voice-ripple-container:has(.clarity:hover) .voice-ripple-0,
        .voice-ripple-container:has(.clarity:hover) .voice-ripple-2,
        .voice-ripple-container:has(.clarity:hover) .voice-ripple-3 { opacity: 0.28; }
        .voice-ripple-container:has(.clarity:hover) .connector-clarity .connector-line { stroke-opacity: 0.42; }
        .voice-ripple-container:has(.clarity:hover) .connector-clarity .connector-dot { fill-opacity: 0.5; }

        .voice-ripple-container:has(.consistency:hover) .voice-ripple-2 { opacity: 0.62; }
        .voice-ripple-container:has(.consistency:hover) .voice-ripple-0,
        .voice-ripple-container:has(.consistency:hover) .voice-ripple-1,
        .voice-ripple-container:has(.consistency:hover) .voice-ripple-3 { opacity: 0.28; }
        .voice-ripple-container:has(.consistency:hover) .connector-consistency .connector-line { stroke-opacity: 0.42; }
        .voice-ripple-container:has(.consistency:hover) .connector-consistency .connector-dot { fill-opacity: 0.5; }

        .voice-ripple-container:has(.presence:hover) .voice-ripple-3 { opacity: 0.5; }
        .voice-ripple-container:has(.presence:hover) .voice-ripple-0,
        .voice-ripple-container:has(.presence:hover) .voice-ripple-1,
        .voice-ripple-container:has(.presence:hover) .voice-ripple-2 { opacity: 0.28; }
        .voice-ripple-container:has(.presence:hover) .connector-presence .connector-line { stroke-opacity: 0.42; }
        .voice-ripple-container:has(.presence:hover) .connector-presence .connector-dot { fill-opacity: 0.5; }

        @keyframes connector-reveal {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .voice-ripple-center-inner {
          width: 70px;
          height: 70px;
          min-width: 70px;
          min-height: 70px;
        }
        .voice-ripple-center-glow {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(ellipse 100% 100% at 50% 50%, rgba(34,211,238,0.12) 0%, rgba(59,130,246,0.08) 35%, rgba(147,51,234,0.04) 55%, transparent 75%);
          pointer-events: none;
        }
        .voice-ripple-center-label {
          max-width: 100%;
          overflow: hidden;
        }
        .voice-ripple-center-title {
          font-size: 0.75rem;
          font-weight: 600;
          line-height: 1.2;
          color: rgb(229 231 235);
        }
        .voice-ripple-center-subtitle {
          font-size: 0.5625rem;
          line-height: 1.25;
          color: rgba(163, 163, 163, 0.7);
          letter-spacing: 0.02em;
        }

        .voice-ripple-label-reveal {
          opacity: 0;
          animation: label-reveal 0.4s ease-out forwards;
        }
        @keyframes label-reveal {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .voice-ripple-system-note {
          position: relative;
          padding-top: 2.5rem;
          margin-top: 1.5rem;
          width: 100%;
        }
        .voice-ripple-system-note-label {
          display: block;
          font-size: 1.0625rem;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(230, 230, 230, 0.92);
          text-align: center;
          margin-bottom: 1.25rem;
          text-shadow: 0 0 32px rgba(59,130,246,0.2), 0 0 12px rgba(147,51,234,0.1);
        }
        @media (min-width: 768px) {
          .voice-ripple-system-note-label {
            text-align: left;
          }
        }
        .voice-ripple-system-note-divider {
          width: 88%;
          max-width: 420px;
          height: 2px;
          flex-shrink: 0;
          margin-bottom: 1.5rem;
          background: linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.5) 25%, rgba(147,51,234,0.45) 50%, rgba(59,130,246,0.5) 75%, transparent 100%);
          box-shadow: 0 0 20px rgba(59,130,246,0.35), 0 0 10px rgba(147,51,234,0.2), 0 0 4px rgba(59,130,246,0.4);
          border-radius: 1px;
        }
        @media (min-width: 768px) {
          .voice-ripple-system-note-divider {
            width: 100%;
            max-width: 100%;
          }
        }
        .voice-ripple-system-note-lines {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          text-align: center;
          width: 100%;
        }
        @media (min-width: 768px) {
          .voice-ripple-system-note-lines {
            align-items: flex-start;
            text-align: left;
          }
        }
        .voice-ripple-system-note-lines span {
          font-size: 1rem;
          line-height: 1.5;
          color: rgba(212, 212, 212, 0.95);
          font-weight: 500;
        }
        .voice-ripple-system-note-lines .space-y-6 > div {
          margin-bottom: 1.5rem;
        }
        .voice-ripple-system-note-lines .space-y-6 > div:last-child {
          margin-bottom: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .voice-ripple, .voice-ripple-0 {
            animation: none;
          }
          .voice-ripple-1 { opacity: 0.42; }
          .voice-ripple-2 { opacity: 0.35; }
          .voice-ripple-3 { opacity: 0.28; }
          .voice-ripple-0 { opacity: 0.7; }
          .voice-ripple-label-reveal {
            animation: none;
            opacity: 1;
          }
          .connector-clarity, .connector-consistency, .connector-presence {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
};

export default Methodology;
