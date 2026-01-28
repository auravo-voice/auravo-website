import React from 'react';

const SocialProof = () => {
  return (
    <section className="py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-950/10 to-transparent"></div>
      <div className="max-w-container mx-auto px-6 relative z-10">
        <div className="text-center animate-fade-in-up">
          <p className="text-body text-neutral-400 mb-8 animate-fade-in-up">
            Trusted by <span className="text-neon-blue font-semibold">500+ professionals</span> across industries
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12">
            <div className="text-neutral-500 font-semibold text-sm hover:text-neon-blue transition-all duration-300 transform hover:scale-110 hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-fade-in border border-neutral-800/50 px-6 py-3 rounded-lg hover:border-neon-blue/50 hover:bg-neon-blue/5 backdrop-blur-sm" style={{ animationDelay: "0.2s" }}>TEDX SPEAKERS</div>
            <div className="text-neutral-500 font-semibold text-sm hover:text-neon-purple transition-all duration-300 transform hover:scale-110 hover:drop-shadow-[0_0_15px_rgba(147,51,234,0.5)] animate-fade-in border border-neutral-800/50 px-6 py-3 rounded-lg hover:border-neon-purple/50 hover:bg-neon-purple/5 backdrop-blur-sm" style={{ animationDelay: "0.4s" }}>MEDIA PROFESSIONALS</div>
            <div className="text-neutral-500 font-semibold text-sm hover:text-neon-cyan transition-all duration-300 transform hover:scale-110 hover:drop-shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-fade-in border border-neutral-800/50 px-6 py-3 rounded-lg hover:border-neon-cyan/50 hover:bg-neon-cyan/5 backdrop-blur-sm" style={{ animationDelay: "0.6s" }}>ENTREPRENEURS</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;