"use client";

import React from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { VEYRA_AI_SUGGESTIONS } from "@/lib/ai/aiService";

interface VeyraAiWelcomeCardProps {
  onSelectPrompt?: (prompt: string) => void;
}

export const VeyraAiWelcomeCard: React.FC<VeyraAiWelcomeCardProps> = ({
  onSelectPrompt,
}) => {
  return (
    <div className="flex flex-col items-center text-center my-auto py-6 px-4 max-w-md mx-auto space-y-5 animate-in fade-in zoom-in-95 duration-200">
      {/* Prominent Veyra AI Logo with Glowing Ring */}
      <div className="relative group">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#2563EB] to-[#14B8A6] opacity-35 blur-lg group-hover:opacity-60 transition duration-500" />
        <div className="relative w-20 h-20 rounded-3xl bg-white dark:bg-[#0F172A] p-2.5 shadow-xl border border-teal-500/30 flex items-center justify-center">
          <Image
            src="/assets/veyra_ai_logo.png"
            alt="Veyra AI"
            width={72}
            height={72}
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Title & Official Bio */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            Veyra AI
          </h2>
         
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-100 leading-relaxed max-w-sm">
          "Your friendly AI companion on Veyra — ask questions, brainstorm ideas, learn something new, or just have a chat."
        </p>
      </div>

      {/* Honest Polished State Banner (Prompt requirement: Do NOT pretend that the AI responded) */}
      <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-teal-500/10 to-transparent border border-teal-500/20 shadow-xs text-left space-y-1.5">
        <div className="flex items-center gap-2 text-[#2563EB] dark:text-[#14B8A6]">
          <Icon name="info" size="xs" />
          <h4 className="text-xs font-bold uppercase tracking-wider">
            Preparation Notice
          </h4>
        </div>
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Veyra AI is getting ready. Your AI companion will be available soon.
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          You can type and submit your thoughts below. Automated generative conversational responses will activate once the backend AI provider is connected.
        </p>
      </div>

      {/* Suggestion Chips */}
      <div className="w-full space-y-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-left px-1">
          Try asking when ready:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {VEYRA_AI_SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt?.(s.prompt)}
              className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-[#2563EB]/50 dark:hover:border-[#14B8A6]/50 transition-all group flex items-start gap-2 text-left"
            >
              <div className="p-1 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0">
                <Icon name={s.icon} size="xs" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block group-hover:text-[#2563EB] dark:group-hover:text-[#14B8A6] transition-colors truncate">
                  {s.title}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {s.prompt}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
