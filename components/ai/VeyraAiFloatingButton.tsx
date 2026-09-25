"use client";

import React from "react";
import Image from "next/image";

interface VeyraAiFloatingButtonProps {
  onClick: () => void;
}

export const VeyraAiFloatingButton: React.FC<VeyraAiFloatingButtonProps> = ({
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      type="button"
      title="Open Veyra AI Companion"
      aria-label="Open Veyra AI Companion"
      className="absolute bottom-20 right-4 sm:bottom-8 sm:right-8 z-30 group flex items-center gap-2.5 p-2 pr-3.5 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md rounded-full shadow-xl shadow-teal-500/15 border border-teal-500/30 hover:border-teal-500/80 transition-all duration-300 hover:scale-105 active:scale-95 animate-float-subtle select-none cursor-pointer"
    >
      <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center p-0.5 bg-gradient-to-tr from-[#2563EB]/15 to-[#14B8A6]/20 ring-1 ring-teal-500/30">
        <Image
          src="/assets/veyra_ai_logo.png"
          alt="Veyra AI"
          width={38}
          height={38}
          className="object-contain group-hover:scale-110 transition-transform duration-300"
          priority
        />
      </div>

      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1">
          <span className="text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#14B8A6]">
            Veyra AI
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Ask anything</span>
      </div>
    </button>
  );
};
