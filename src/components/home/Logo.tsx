'use client';
import React from 'react';

const Logo = () => {
  return (
    <a 
      href="/" 
      className="absolute top-3 left-3 md:top-4 md:left-6 z-50 hover:scale-105 transition-transform duration-300 group"
      aria-label="auravo - Home"
    >
      {/* Subtle backdrop for better visibility */}
      <div className="absolute inset-0 -inset-2 bg-black/20 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
      
      <img 
        src="/logo.png" 
        alt="auravo" 
        className="w-24 md:w-[170px] drop-shadow-[0_0_30px_rgba(59,130,246,0.4),0_0_60px_rgba(147,51,234,0.2)] group-hover:drop-shadow-[0_0_40px_rgba(59,130,246,0.6),0_0_80px_rgba(147,51,234,0.4)] transition-all duration-300 brightness-110" 
      />
    </a>
  );
};

export default Logo;
