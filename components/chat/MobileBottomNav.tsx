"use client";

import React from "react";
import { NavigationTab, NAVIGATION_ITEMS } from "@/constants/brand";
import { Icon } from "@/components/ui/Icon";

interface MobileBottomNavProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/90 px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-lg">
      {NAVIGATION_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[44px] px-2 py-1 rounded-2xl transition-all duration-200 active:scale-95 ${
              isActive
                ? "text-[#2563EB] dark:text-[#14B8A6] font-bold bg-[#2563EB]/10 dark:bg-[#14B8A6]/15"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon name={item.icon} size="sm" fill={isActive} />
            <span className="text-[11px] font-medium tracking-tight leading-tight">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
