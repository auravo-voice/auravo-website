"use client"

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const SQRT_5000 = Math.sqrt(5000);

const testimonials = [
  {
    tempId: 0,
    testimonial: "Urmi transformed not just my voice, but my entire presence. The confidence I gained opened doors I never imagined.",
    by: "Sarah Chen, VP of Marketing, Tech Startup"
  },
  {
    tempId: 1,
    testimonial: "The interview coaching was game-changing. I went from nervous to commanding the room in just three sessions.",
    by: "Michael Rodriguez, Senior Director, Fortune 500"
  },
  {
    tempId: 2,
    testimonial: "Urmi's approach goes beyond technique. She helps you find your authentic voice and use it powerfully.",
    by: "Dr. Jennifer Walsh, TEDx Speaker & Author"
  },
  {
    tempId: 3,
    testimonial: "From jittery to compelling—my delivery is calmer, clearer, and more persuasive in every meeting.",
    by: "Amit Patel, Product Lead, FinTech"
  },
  {
    tempId: 4,
    testimonial: "I finally sound like the leader I’ve always been. The storytelling drills were a breakthrough.",
    by: "Laura Kim, Engineering Manager, AI Startup"
  },
  {
    tempId: 5,
    testimonial: "Our exec team’s communication leveled up across the board—concise, confident, and aligned.",
    by: "James O’Neill, COO, Enterprise SaaS"
  }
];

function getInitials(by: string) {
  const name = by.split(',')[0] || '';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

interface TestimonialCardProps {
  position: number;
  testimonial: typeof testimonials[0];
  handleMove: (steps: number) => void;
  cardSize: number;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({ 
  position, 
  testimonial, 
  handleMove, 
  cardSize 
}) => {
  const isCenter = position === 0;

  return (
    <div
      onClick={() => handleMove(position)}
      className={cn(
        "absolute left-1/2 top-1/2 cursor-pointer border p-8 transition-all duration-500 ease-in-out backdrop-blur-sm",
        isCenter 
          ? "z-10 text-neutral-100 border-neon-blue/50 bg-gradient-to-br from-neutral-900/90 via-neutral-800/80 to-neutral-900/90 shadow-glow" 
          : "z-0 bg-neutral-900/60 text-neutral-300 border-neutral-800/50 hover:border-neon-blue/30 hover:bg-neutral-900/80"
      )}
      style={{
        width: cardSize,
        height: cardSize,
        clipPath: `polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)` ,
        transform: `
          translate(-50%, -50%) 
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        boxShadow: isCenter ? "0px 8px 0px 4px rgba(59, 130, 246, 0.2), 0 0 30px rgba(59, 130, 246, 0.3)" : "0px 0px 0px 0px transparent"
      }}
    >
      <span
        className="absolute block origin-top-right rotate-45 bg-neon-blue/50"
        style={{
          right: -2,
          top: 48,
          width: SQRT_5000,
          height: 2
        }}
      />
      <div
        aria-hidden
        className={cn(
          "mb-4 h-12 w-12 rounded-full font-semibold grid place-items-center",
          isCenter ? "bg-gradient-to-br from-neon-blue/30 to-neon-purple/30 text-neutral-100" : "bg-neutral-800/50 text-neutral-400"
        )}
        style={{ boxShadow: "3px 3px 0px rgba(0, 0, 0, 0.3)" }}
      >
        {getInitials(testimonial.by)}
      </div>
      <h3 className={cn(
        "text-base sm:text-xl font-medium",
        isCenter ? "text-neutral-100" : "text-neutral-300"
      )}>
        "{testimonial.testimonial}"
      </h3>
      <p className={cn(
        "absolute bottom-8 left-8 right-8 mt-2 text-sm italic",
        isCenter ? "text-neutral-400" : "text-neutral-500"
      )}>
        - {testimonial.by}
      </p>
    </div>
  );
};

export const StaggerTestimonials: React.FC = () => {
  const [cardSize, setCardSize] = useState(365);
  const [testimonialsList, setTestimonialsList] = useState(testimonials);

  const handleMove = (steps: number) => {
    const newList = [...testimonialsList];
    if (steps > 0) {
      for (let i = steps; i > 0; i--) {
        const item = newList.shift();
        if (!item) return;
        newList.push({ ...item, tempId: Math.random() });
      }
    } else {
      for (let i = steps; i < 0; i++) {
        const item = newList.pop();
        if (!item) return;
        newList.unshift({ ...item, tempId: Math.random() });
      }
    }
    setTestimonialsList(newList);
  };

  useEffect(() => {
    const updateSize = () => {
      const { matches } = window.matchMedia("(min-width: 640px)");
      setCardSize(matches ? 365 : 290);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 600 }}
    >
      {testimonialsList.slice(0, 5).map((testimonial, index) => {
        // Always show 5 cards: center and 2 on either side
        const len = 5;
        const position = len % 2 === 1
          ? index - (len - 1) / 2
          : index - (len / 2 - 0.5);
        return (
          <TestimonialCard
            key={testimonial.tempId}
            testimonial={testimonial}
            handleMove={handleMove}
            position={position}
            cardSize={cardSize}
          />
        );
      })}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        <button
          onClick={() => handleMove(-1)}
          className={cn(
            "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
            "bg-neutral-900/80 border-2 border-neutral-800 hover:bg-neon-blue hover:border-neon-blue hover:text-white hover:shadow-glow-blue",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 backdrop-blur-sm"
          )}
          aria-label="Previous testimonial"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => handleMove(1)}
          className={cn(
            "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
            "bg-neutral-900/80 border-2 border-neutral-800 hover:bg-neon-blue hover:border-neon-blue hover:text-white hover:shadow-glow-blue",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue focus-visible:ring-offset-2 backdrop-blur-sm"
          )}
          aria-label="Next testimonial"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
};

export default StaggerTestimonials;
