"use client";

import React, { useEffect, useState } from "react";

interface FallingHeartsAnimationProps {
  active: boolean;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  emoji: string;
  left: number; // percentage
  size: number; // px
  duration: number; // seconds
  delay: number; // seconds
  drift: number; // px horizontal sway
  rotation: number; // degrees
}

const HEART_EMOJIS = ["❤️", "💖", "💕", "💗", "💓", "💘", "✨", "❤️"];

export const FallingHeartsAnimation: React.FC<FallingHeartsAnimationProps> = ({
  active,
  onComplete,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    // Generate 32 randomized falling hearts
    const items: Particle[] = Array.from({ length: 32 }).map((_, i) => ({
      id: Date.now() + i,
      emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
      left: Math.random() * 90 + 5, // 5% to 95%
      size: Math.floor(Math.random() * 20) + 20, // 20px to 40px
      duration: Math.random() * 1.4 + 1.8, // 1.8s to 3.2s
      delay: Math.random() * 0.45, // 0 to 0.45s
      drift: Math.floor(Math.random() * 50) - 25, // -25px to +25px
      rotation: Math.floor(Math.random() * 60) - 30, // -30deg to +30deg
    }));

    setParticles(items);

    const timer = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 3400);

    return () => clearTimeout(timer);
  }, [active, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-40"
      aria-hidden="true"
    >
      <style>{`
        @keyframes fallHeartSway {
          0% {
            transform: translate3d(0, -50px, 0) rotate(0deg) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translate3d(calc(var(--drift) * 0.3), 10vh, 0) rotate(var(--rot)) scale(1.15);
          }
          50% {
            transform: translate3d(calc(var(--drift) * -0.5), 50vh, 0) rotate(calc(var(--rot) * -1)) scale(1);
          }
          85% {
            opacity: 0.9;
          }
          100% {
            transform: translate3d(var(--drift), 105vh, 0) rotate(var(--rot)) scale(0.8);
            opacity: 0;
          }
        }
      `}</style>

      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute select-none will-change-transform"
          style={
            {
              left: `${p.left}%`,
              top: `-10px`,
              fontSize: `${p.size}px`,
              animation: `fallHeartSway ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s forwards`,
              filter: "drop-shadow(0 4px 10px rgba(244, 63, 94, 0.4))",
              "--drift": `${p.drift}px`,
              "--rot": `${p.rotation}deg`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
};
