"use client";

import React, { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

interface StorageSectionProps {
  onBack: () => void;
}

export const StorageSection: React.FC<StorageSectionProps> = ({ onBack }) => {
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const handleClearCache = () => {
    setIsClearing(true);
    setTimeout(() => {
      try {
        // Clear local storage temporary caches if any
        if (typeof window !== "undefined") {
          sessionStorage.clear();
        }
      } catch {}
      setIsClearing(false);
      setClearSuccess(true);
      setTimeout(() => setClearSuccess(false), 2000);
    }, 600);
  };

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
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12 truncate">
          Data and Storage
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5">
        {/* Storage Breakdown */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Storage Usage
            </h4>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              ~24.5 MB Used
            </span>
          </div>

          {/* Visual Bar */}
          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            <div className="w-[50%] bg-[#2563EB]" title="Images (12 MB)" />
            <div className="w-[25%] bg-purple-500" title="GIFs (6 MB)" />
            <div className="w-[15%] bg-[#14B8A6]" title="Stickers (3.5 MB)" />
            <div className="w-[10%] bg-amber-400" title="Cached Data (3 MB)" />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              <span>Images (~12 MB)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>GIFs (~6 MB)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]" />
              <span>Stickers (~3.5 MB)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Cached (~3 MB)</span>
            </div>
          </div>
        </div>

        {/* Clear Local Cache */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Clear Local Cache
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Free up browser memory by clearing cached preview thumbnails
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              isLoading={isClearing}
              onClick={handleClearCache}
            >
              {clearSuccess ? "Cleared!" : "Clear Cache"}
            </Button>
          </div>
        </div>

        {/* Network Transfer Stats */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          <div className="p-3.5 px-4 font-bold uppercase tracking-wider text-slate-400 text-[11px]">
            Network Transfer
          </div>

          <div className="flex items-center justify-between p-3.5 px-4">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Icon name="arrow_upward" size="xs" className="text-blue-500" />
              <span>Sent Data</span>
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              18.4 MB
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 px-4">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Icon name="arrow_downward" size="xs" className="text-teal-500" />
              <span>Received Data</span>
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              42.1 MB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
