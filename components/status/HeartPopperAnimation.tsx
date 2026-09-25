"use client";

import React, { useEffect, useState } from "react";

interface HeartPopperAnimationProps {
  active: boolean;
  onComplete?: () => void;
}

const HEARTS = [
  { id: 1, x: -24, y: -48, scale: 0.9, rot: -16, delay: 0 },
  { id: 2, x: 0, y: -64, scale: 1.2, rot: 0, delay: 40 },
  { id: 3, x: 24, y: -48, scale: 0.95, rot: 16, delay: 20 },
  { id: 4, x: -12, y: -30, scale: 0.75, rot: -8, delay: 60 },
  { id: 5, x: 14, y: -32, scale: 0.8, rot: 10, delay: 80 },
];

export const HeartPopperAnimation: React.FC<HeartPopperAnimationProps> = ({
  active,
  onComplete,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 700);

    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [active, onComplete]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible z-50 select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes simpleHeartPop {
          0% {
            transform: translate3d(0, 0, 0) scale(0.3);
            opacity: 0;
          }
          25% {
            transform: translate3d(calc(var(--pop-x) * 0.5), calc(var(--pop-y) * 0.5), 0) scale(1.15) rotate(var(--pop-rot));
            opacity: 1;
          }
          70% {
            transform: translate3d(var(--pop-x), var(--pop-y), 0) scale(1) rotate(var(--pop-rot));
            opacity: 0.85;
          }
          100% {
            transform: translate3d(var(--pop-x), calc(var(--pop-y) - 10px), 0) scale(0.6) rotate(var(--pop-rot));
            opacity: 0;
          }
        }
      `}</style>

      {HEARTS.map((h) => (
        <div
          key={h.id}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={
            {
              "--pop-x": `${h.x}px`,
              "--pop-y": `${h.y}px`,
              "--pop-rot": `${h.rot}deg`,
              animation: `simpleHeartPop 0.65s cubic-bezier(0.16, 1, 0.3, 1) ${h.delay}ms forwards`,
            } as React.CSSProperties
          }
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-rose-500 drop-shadow-[0_2px_6px_rgba(244,63,94,0.45)]"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      ))}
    </div>
  );
};
