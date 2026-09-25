"use client";

import React from "react";
import { Icon } from "@/components/ui/Icon";

interface NotificationsSectionProps {
  onBack: () => void;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({ onBack }) => {
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
          Notifications
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
          <Icon name="notifications" size="lg" />
        </div>

        <div className="space-y-1.5 max-w-xs">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-bold mb-1">
            Coming Soon
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Notification Preferences
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Web Push notifications, sound tones, and per-conversation muting controls will be available in Veyra V2.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 text-left max-w-xs w-full text-xs space-y-2 mt-4">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            Planned Features:
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
            <li>Native Web Push notifications</li>
            <li>Custom message & call sounds</li>
            <li>In-app notification banners</li>
            <li>Mute individual chats or groups</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
