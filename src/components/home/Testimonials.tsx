'use client';
import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const VoiceReviewFeedback = () => {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  const insights = [
    {
      label: 'Rushed Sentence Start',
      timestamp: '0:08',
      text: 'At the point where you begin the second sentence, the first word comes out slightly rushed, causing the beginning sound to blur. Slowing the entry into that sentence would improve clarity.',
    },
    {
      label: 'Dropped Ending Sound',
      timestamp: '0:14',
      text: 'During the section where you pronounce "alignment," the ending consonant drops off. Finishing the final "t" would make the word feel complete and clearer. You can hear this in the line "This approach brings everything into clear alignment."',
    },
    {
      label: 'Flat Tone Moment',
      timestamp: '0:19',
      text: 'In the moment where your tone dips right after explaining your main point, your voice becomes a bit flat. Adding a small lift in pitch there would help keep it engaging. This occurs in the line "And that\'s what actually makes the difference."',
    },
    {
      label: 'Breathy Transition',
      timestamp: '0:26',
      text: 'Right before you transition into your final line, there\'s a noticeable inhale that makes "overall" sound softer than intended. A smoother breath would make that transition tighter and more confident.',
    },
  ];

  // Cycle through active cards
  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % insights.length);
    }, 2300);

    return () => clearInterval(interval);
  }, [prefersReducedMotion, insights.length]);

  return (
    <section className="py-12 md:py-16 relative overflow-hidden bg-gradient-to-b from-neutral-950 via-black to-neutral-950 fade-in-on-scroll">
      {/* Stage: Radial glow centered on phone + vignette */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] bg-gradient-radial from-neon-purple/15 via-neon-blue/8 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />

      <div className="max-w-container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center">
          {/* Explanatory Text Column */}
          <motion.div
className="flex flex-col justify-center space-y-6 md:space-y-8 md:-mt-16 lg:-mt-36"
initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* ✅ Mascot above heading (no absolute positioning, so it won't overlap text) */}
            <div
              className="mb-2 flex justify-center md:justify-start w-52 h-52 md:w-64 md:h-64 lg:w-80 lg:h-80 rounded-none shadow-none ring-0 border-0"
              style={{ background: '#000', boxShadow: 'none' }}
            >
              <video
                src="/voca-looking-down.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain outline-none [box-shadow:none]"
                style={{ background: '#000' }}
              />
            </div>

            <h3 className="text-2xl md:text-3xl font-semibold text-neutral-100 leading-tight">
              How Voca gives feedback
            </h3>

            <div className="space-y-5 text-neutral-300 leading-relaxed">
              <p className="text-base md:text-lg">Voca listens for patterns, not perfection.</p>
              <p className="text-base md:text-lg">
                Instead of scoring or correcting everything, it highlights the moments that change how your voice is received.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <p className="text-sm md:text-base font-medium text-neutral-200 mb-3">Each note is:</p>
              <ul className="space-y-3 text-base md:text-lg text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-neutral-500 mt-1">–</span>
                  <span>
                    <strong className="text-neutral-200">Timestamped</strong> — tied to an exact moment
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-neutral-500 mt-1">–</span>
                  <span>
                    <strong className="text-neutral-200">Focused</strong> — one adjustment at a time
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-neutral-500 mt-1">–</span>
                  <span>
                    <strong className="text-neutral-200">Actionable</strong> — something you can practice immediately
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-4 pt-2">
              <p className="text-base md:text-lg text-neutral-300 leading-relaxed">The goal isn't to sound different.</p>
              <p className="text-base md:text-lg text-neutral-300 leading-relaxed">
                It's to remove what gets in the way of clarity and presence.
              </p>
            </div>

            <p className="text-sm text-neutral-500 pt-2">Designed to guide practice, not overwhelm.</p>
          </motion.div>

          {/* Mobile Phone Mockup */}
          <div className="w-full max-w-[380px] md:max-w-[420px] mx-auto md:mx-0">
            {/* Phone Frame - Pure CSS */}
            <div className="relative mx-auto">
              {/* Phone outer frame with rounded corners and notch */}
              <div className="relative bg-neutral-900 rounded-[3rem] p-2 shadow-2xl border border-neutral-800/50">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-neutral-900 rounded-b-2xl z-10" />
                {/* Screen */}
                <div className="relative bg-neutral-950 rounded-[2.5rem] overflow-hidden">
                  {/* Status Bar */}
                  <div className="flex items-center justify-between px-6 pt-3 pb-2">
                    <span className="text-xs font-medium text-neutral-300">9:41</span>
                    <div className="flex items-center gap-1.5">
                      {/* Signal bars */}
                      <div className="flex items-end gap-0.5">
                        <div className="w-1 h-1.5 bg-neutral-300 rounded-sm" />
                        <div className="w-1 h-2 bg-neutral-300 rounded-sm" />
                        <div className="w-1 h-2.5 bg-neutral-300 rounded-sm" />
                        <div className="w-1 h-3 bg-neutral-300 rounded-sm" />
                      </div>
                      {/* WiFi icon */}
                      <div className="w-4 h-3 relative">
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-2 border-neutral-300 rounded-full border-t-transparent border-r-transparent" />
                        <div className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border border-neutral-300 rounded-full border-t-transparent border-r-transparent" />
                      </div>
                      {/* Battery */}
                      <div className="w-5 h-2.5 border border-neutral-300 rounded-sm relative">
                        <div className="absolute right-0 top-0.5 w-0.5 h-1.5 bg-neutral-300 rounded-r-sm" />
                        <div className="absolute left-0.5 top-0.5 w-3.5 h-1.5 bg-neutral-300 rounded-sm" />
                      </div>
                    </div>
                  </div>

                  {/* App Content */}
                  <div className="px-6 pb-8">
                    {/* Header */}
                    <header className="mb-3">
                      <h2 className="text-xl font-semibold text-neutral-100 mb-1">Voca Voice Review</h2>
                      <p className="text-sm text-neutral-400 mb-4">Feedback from a 34-second clip</p>

                      {/* Progress line with timestamp markers */}
                      <div className="relative h-0.5 bg-neutral-800/50 rounded-full mt-4">
                        {insights.map((insight, index) => (
                          <div
                            key={index}
                            className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full transition-all duration-500"
                            style={{
                              left: `${(parseFloat(insight.timestamp.split(':')[1]) / 34) * 100}%`,
                              backgroundColor: activeIndex === index ? '#9333EA' : '#525252',
                              width: activeIndex === index ? '6px' : '4px',
                              height: activeIndex === index ? '6px' : '4px',
                              boxShadow: activeIndex === index ? '0 0 8px rgba(147, 51, 234, 0.6)' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    </header>

                    {/* Notes List */}
                    <div className="mt-5 space-y-2.5">
                      {insights.map((insight, index) => {
                        const isActive = activeIndex === index;
                        return (
                          <motion.article
                            key={index}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{
                              duration: 0.4,
                              delay: index * 0.12,
                              ease: 'easeOut',
                            }}
                            animate={
                              prefersReducedMotion
                                ? {}
                                : {
                                    opacity: isActive ? 1 : 0.7,
                                    scale: isActive ? 1 : 0.98,
                                  }
                            }
                            whileHover={{
                              y: -3,
                              scale: 1.01,
                              transition: { duration: 0.2 },
                            }}
                            className={`
                              group relative bg-gradient-to-br from-neutral-900/70 to-neutral-900/50 
                              border rounded-xl p-4 transition-all duration-300
                              cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950
                              ${
                                isActive
                                  ? 'border-neon-purple/60 shadow-lg shadow-neon-purple/20 bg-gradient-to-br from-neutral-900/90 to-neutral-900/70'
                                  : 'border-neutral-800/40 hover:border-neutral-700/60 hover:bg-neutral-900/80 hover:shadow-lg hover:shadow-neon-purple/10'
                              }
                            `}
                            style={{
                              boxShadow: isActive
                                ? '0 4px 20px rgba(147, 51, 234, 0.15), inset 0 0 20px rgba(147, 51, 234, 0.05)'
                                : undefined,
                            }}
                          >
                            {/* Active glow effect */}
                            {isActive && (
                              <motion.div
                                className="absolute inset-0 rounded-xl bg-gradient-to-br from-neon-purple/5 to-transparent pointer-events-none"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                              />
                            )}

                            <div className="relative flex items-start justify-between gap-3 mb-2">
                              <span
                                className={`
                                  text-[10px] font-medium uppercase tracking-wider
                                  ${isActive ? 'text-neon-blue/90' : 'text-neon-blue/60'}
                                `}
                              >
                                {insight.label}
                              </span>

                              <motion.span
                                className={`
                                  text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-300
                                  ${
                                    isActive
                                      ? 'text-neutral-200 bg-neutral-800/70'
                                      : 'text-neutral-400 bg-neutral-800/50 group-hover:text-neutral-300 group-hover:bg-neutral-800/60'
                                  }
                                `}
                                whileHover={{ scale: 1.05 }}
                              >
                                {insight.timestamp}
                              </motion.span>
                            </div>

                            <p
                              className={`
                                text-[15px] leading-relaxed
                                ${isActive ? 'text-neutral-100' : 'text-neutral-200'}
                              `}
                              style={{ lineHeight: '1.6' }}
                            >
                              {insight.text}
                            </p>
                          </motion.article>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <footer className="mt-6 pt-4 border-t border-neutral-800/40">
                      <button className="w-full flex items-center justify-between group text-left">
                        <span className="text-sm font-medium text-neutral-300 group-hover:text-neutral-100 transition-colors duration-200">
                          Start practice with these highlights
                        </span>
                        <motion.span
                          className="text-neutral-400 group-hover:text-neon-purple transition-colors duration-200"
                          animate={prefersReducedMotion ? {} : { x: [0, 4, 0] }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        >
                          →
                        </motion.span>
                      </button>
                    </footer>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* end phone */}
        </div>
      </div>
    </section>
  );
};

export default VoiceReviewFeedback;
