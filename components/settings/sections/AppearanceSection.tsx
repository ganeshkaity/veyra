"use client";

import React from "react";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/components/providers/ThemeProvider";

interface AppearanceSectionProps {
  onBack: () => void;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Settings</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          Appearance
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-6">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Interface Theme
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Select your preferred visual style. Default is crisp Light mode with Veyra signature accents.
          </p>
        </div>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Light Mode Card */}
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`group flex flex-col items-center p-3 rounded-2xl border-2 transition-all text-left bg-white ${
              theme === "light"
                ? "border-[#2563EB] shadow-md ring-2 ring-blue-500/20"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            {/* Visual Mini Mockup */}
            <div className="w-full h-32 rounded-xl bg-slate-100 border border-slate-200/80 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner">
              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                <div className="w-12 h-2 rounded bg-slate-300" />
              </div>
              <div className="space-y-1.5 py-1">
                <div className="w-20 h-4 rounded-lg bg-white border border-slate-200 shadow-xs text-[8px] flex items-center px-1.5 text-slate-600">
                  Hello! 👋
                </div>
                <div className="w-24 h-4 rounded-lg bg-[#2563EB] text-white shadow-xs text-[8px] flex items-center px-1.5 ml-auto">
                  Har Baat, Apno Ke Saath
                </div>
              </div>
              <div className="w-full h-4 rounded-md bg-white border border-slate-200" />
            </div>

            <div className="flex items-center justify-between w-full mt-3 px-1">
              <span className="text-xs font-bold text-slate-800">Light (Default)</span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  theme === "light"
                    ? "border-[#2563EB] bg-[#2563EB] text-white"
                    : "border-slate-300"
                }`}
              >
                {theme === "light" && <Icon name="check" size="xs" className="w-3 h-3 text-[10px]" />}
              </div>
            </div>
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`group flex flex-col items-center p-3 rounded-2xl border-2 transition-all text-left bg-[#0F172A] ${
              theme === "dark"
                ? "border-[#14B8A6] shadow-md ring-2 ring-teal-500/20"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            {/* Visual Mini Mockup */}
            <div className="w-full h-32 rounded-xl bg-[#0B1120] border border-slate-800 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner">
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]" />
                <div className="w-12 h-2 rounded bg-slate-700" />
              </div>
              <div className="space-y-1.5 py-1">
                <div className="w-20 h-4 rounded-lg bg-slate-800 text-[8px] flex items-center px-1.5 text-slate-300">
                  Hello! 👋
                </div>
                <div className="w-24 h-4 rounded-lg bg-[#14B8A6] text-white text-[8px] flex items-center px-1.5 ml-auto">
                  Har Baat, Apno Ke Saath
                </div>
              </div>
              <div className="w-full h-4 rounded-md bg-slate-800/80 border border-slate-700" />
            </div>

            <div className="flex items-center justify-between w-full mt-3 px-1">
              <span className="text-xs font-bold text-slate-100">Dark Mode</span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  theme === "dark"
                    ? "border-[#14B8A6] bg-[#14B8A6] text-white"
                    : "border-slate-600"
                }`}
              >
                {theme === "dark" && <Icon name="check" size="xs" className="w-3 h-3 text-[10px]" />}
              </div>
            </div>
          </button>
        </div>

        {/* Brand Accent Palette Note */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Veyra Brand Colors
          </h5>
          <div className="flex items-center gap-2 pt-1">
            <div className="w-6 h-6 rounded-lg bg-[#2563EB] shadow-xs" title="Primary Blue" />
            <div className="w-6 h-6 rounded-lg bg-[#14B8A6] shadow-xs" title="Primary Teal" />
            <div className="w-6 h-6 rounded-lg bg-[#0F172A] shadow-xs" title="Deep Navy" />
            <div className="w-6 h-6 rounded-lg bg-[#F8FAFC] border border-slate-200 shadow-xs" title="Light Background" />
          </div>
        </div>
      </div>
    </div>
  );
};
