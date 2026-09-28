"use client";

import React from "react";
import Image from "next/image";

interface VeyraAiFloatingButtonProps {
  onClick: () => void;
  className?: string;
}

export const VeyraAiFloatingButton: React.FC<VeyraAiFloatingButtonProps> = ({
  onClick,
  className = "bottom-20 right-4",
}) => {
  return (
    <button
      onClick={onClick}
      type="button"
      title="Open Veyra AI"
      aria-label="Open Veyra AI"
      className={`fixed z-30 flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 p-1.5 rounded-full bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md shadow-xl shadow-teal-500/25 border-2 border-teal-500/60 hover:border-teal-400 transition-all duration-300 hover:scale-105 active:scale-95 animate-float-subtle select-none cursor-pointer group ${className}`}
    >
      <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center p-1 bg-gradient-to-tr from-[#2563EB]/20 via-[#14B8A6]/25 to-blue-500/20">
        <Image
          src="/assets/veyra_ai_logo.png"
          alt="Veyra AI"
          width={36}
          height={36}
          className="object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md"
          priority
        />
      </div>
      <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-teal-400 ring-2 ring-white dark:ring-[#0F172A] animate-pulse" />
    </button>
  );
};
