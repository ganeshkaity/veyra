"use client";

import React from "react";
import Image from "next/image";
import { NavigationTab, NAVIGATION_ITEMS } from "@/constants/brand";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";

interface DesktopSidebarNavProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onOpenAi: () => void;
}

export const DesktopSidebarNav: React.FC<DesktopSidebarNavProps> = ({
  activeTab,
  onTabChange,
  onOpenAi,
}) => {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden md:flex flex-col items-center justify-between w-[68px] h-screen py-4 bg-slate-100/90 dark:bg-[#0B1120] border-r border-slate-200/80 dark:border-slate-800 z-30 select-none flex-shrink-0">
      {/* Top Section: Brand icon & Main Nav Tabs */}
      <div className="flex flex-col items-center gap-5 w-full">
        {/* Brand Logo */}
        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex items-center justify-center p-1 bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
          <Image
            src="/assets/main_logo.png"
            alt="Veyra"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>

        {/* Navigation Tab Icons */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-2">
          {NAVIGATION_ITEMS.filter((item) => item.id !== "you").map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={item.label}
                aria-label={item.label}
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/25"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon name={item.icon} size="md" fill={isActive} />
                {isActive && (
                  <span className="absolute -left-2 w-1 h-5 rounded-r bg-[#2563EB] hidden" />
                )}
              </button>
            );
          })}

          {/* Veyra AI dedicated sidebar action */}
          <button
            onClick={onOpenAi}
            title="Veyra AI Companion"
            aria-label="Veyra AI Companion"
            className="w-11 h-11 mt-1 rounded-xl flex items-center justify-center transition-all duration-200 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 group relative"
          >
            <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center p-0.5">
              <Image
                src="/assets/veyra_ai_logo.png"
                alt="Veyra AI"
                width={28}
                height={28}
                className="object-contain group-hover:scale-110 transition-transform"
              />
            </div>
          </button>
        </nav>
      </div>

      {/* Bottom Section: Theme toggle, Profile, Settings */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        <button
          onClick={toggleTheme}
          title="Toggle Theme"
          aria-label="Toggle Theme"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size="sm" />
        </button>

        <button
          onClick={() => onTabChange("you")}
          title="Your Profile"
          aria-label="Your Profile"
          className={`relative p-0.5 rounded-full transition-transform active:scale-95 ${
            activeTab === "you" ? "ring-2 ring-[#2563EB]" : ""
          }`}
        >
          <Avatar
            name={profile?.displayName || "User"}
            src={profile?.avatarUrl}
            size="sm"
            isOnline={true}
          />
        </button>
      </div>
    </aside>
  );
};
