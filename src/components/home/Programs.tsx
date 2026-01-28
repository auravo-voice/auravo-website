import React from 'react';
const Programs = () => {
  const programs = [
    {
      title: "Find the voice that feels like you.",
      description:
        "A guided speech discovery program designed to help you uncover your natural speaking style, remove unconscious blocks, and develop confident, effortless expression. Through expert-led sessions, you'll move beyond rehearsed delivery and learn how to speak with clarity, ease, and authentic presence in conversations, presentations, and professional settings.",
      type: "Speech Discovery",
    },
    {
      title: "Clarity without losing your identity.",
      description:
        "A refined accent improvement program focused on clarity, rhythm, and intelligibility without erasing who you are. Our coaches help you soften distracting pronunciation patterns, improve fluency, and sound more natural and confident across professional, academic, and social environments, while preserving your unique voice and cultural identity.",
      type: "Accent & Clarity",
    },
  ];

  return (
    <section id="programs" className="py-20 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-1/4 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse-slow"></div>
      <div
        className="absolute bottom-0 left-1/4 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse-slow"
        style={{ animationDelay: "1s" }}
      ></div>

      <div className="max-w-container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="text-h1 text-neutral-100 mb-6 animate-fade-in-up">
            Auravo <span className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">Tracks</span>
          </h2>
          <p
            className="text-body-lg text-neutral-400 max-w-2xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            Choose an auravo track designed for your campus, workplace, or institution—each focused on real world communication results.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {programs.map((program, index) => (
            <div
              key={index}
              className="relative overflow-hidden bg-neutral-900/40 backdrop-blur-md rounded-2xl p-8 shadow-glow-soft hover:shadow-glow transition-all duration-500 border border-neutral-800/50 hover:border-neon-blue/50 transform hover:-translate-y-2 hover:scale-[1.02] group animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Decorative gradient glow */}
              <div className="pointer-events-none absolute -top-10 -right-12 w-48 h-48 bg-gradient-to-tr from-neon-blue/20 to-neon-purple/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              {/* Top accent bar */}
              <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-transparent via-neon-blue/60 to-transparent group-hover:via-neon-purple/60 transition-all duration-500"></div>

              <div className="mb-4">
                <span className="inline-flex items-center gap-2 bg-neon-blue/10 border border-neon-blue/20 text-neon-blue text-body-sm px-3 py-1 rounded-full group-hover:bg-neon-blue/20 group-hover:scale-105 group-hover:shadow-glow-blue transition-all duration-300">
                  <span className="inline-flex h-2 w-2 rounded-full bg-neon-blue animate-pulse"></span>
                  {program.type}
                </span>
              </div>
              <div className="flex items-start gap-3 mb-2">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 flex items-center justify-center text-lg group-hover:shadow-glow transition-all duration-300">
                  <span role="img" aria-label="voice">🎤</span>
                </div>
                <h3 className="text-h2 text-neutral-100 group-hover:text-neon-blue transition-colors duration-300">{program.title}</h3>
              </div>
              <p className="text-neutral-400 mb-6 leading-relaxed group-hover:text-neutral-300 transition-colors duration-300">
                {program.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Programs;