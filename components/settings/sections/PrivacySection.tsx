"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { updateUserProfile } from "@/lib/firestore/userService";
import { useAuth } from "@/components/providers/AuthProvider";
import { LockChatSection } from "./LockChatSection";

interface PrivacySectionProps {
  currentUser: UserProfile;
  onBack: () => void;
  initialSubSection?: "lock-chats" | null;
}

export const PrivacySection: React.FC<PrivacySectionProps> = ({
  currentUser,
  onBack,
  initialSubSection = null,
}) => {
  const { refreshProfile } = useAuth();
  const [subSection, setSubSection] = useState<"lock-chats" | null>(initialSubSection);
  const [readReceipts, setReadReceipts] = useState<boolean>(
    currentUser.readReceiptsEnabled !== false
  );
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync subSection with browser history popstate without page reloads
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname.endsWith("/lock-chats")) {
          setSubSection("lock-chats");
        } else {
          setSubSection(null);
        }
      }
    };

    if (typeof window !== "undefined" && window.location.pathname.endsWith("/lock-chats")) {
      setSubSection("lock-chats");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleOpenLockChat = () => {
    setSubSection("lock-chats");
    if (typeof window !== "undefined") {
      window.history.pushState({ subSection: "lock-chats" }, "", "/setting/privacy/lock-chats");
    }
  };

  const handleBackFromLockChat = () => {
    setSubSection(null);
    if (typeof window !== "undefined") {
      if (window.location.pathname.endsWith("/lock-chats")) {
        window.history.back();
      } else {
        window.history.replaceState(null, "", "/setting/privacy");
      }
    }
  };

  const handleToggleReadReceipts = async () => {
    const newValue = !readReceipts;
    setReadReceipts(newValue);
    try {
      setIsUpdating(true);
      await updateUserProfile(currentUser.uid, {
        readReceiptsEnabled: newValue,
      });
      await refreshProfile();
    } catch (err) {
      console.error("Failed to update read receipts preference:", err);
      setReadReceipts(!newValue);
    } finally {
      setIsUpdating(false);
    }
  };

  // If Lock Chat sub-section is active, render it in-place
  if (subSection === "lock-chats") {
    return (
      <LockChatSection
        currentUser={currentUser}
        onBack={handleBackFromLockChat}
      />
    );
  }

  const isLockChatActive = Boolean(
    currentUser.lockedChatEnabled && currentUser.lockedChatPasskey
  );

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors cursor-pointer"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Settings</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          Privacy
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5">
        {/* Lock Chat Option (Navigates to /setting/privacy/lock-chats without reload) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={handleOpenLockChat}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
                <Icon name="lock" size="sm" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-teal-400 transition-colors">
                  Lock Chat
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Hide sensitive chats behind a secret passkey
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isLockChatActive
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isLockChatActive ? "Enabled" : "Off"}
              </span>
              <Icon
                name="chevron_right"
                size="sm"
                className="text-slate-400 group-hover:translate-x-0.5 transition-transform"
              />
            </div>
          </button>
        </div>

        {/* Read Receipts Card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Read Receipts
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Send and receive double checkmarks (✓✓)
              </p>
            </div>

            {/* iOS-style toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={readReceipts}
              disabled={isUpdating}
              onClick={handleToggleReadReceipts}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                readReceipts
                  ? "bg-[#2563EB] dark:bg-[#14B8A6]"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  readReceipts ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            If turned off, you won't send or see Read receipts (brand-colored ✓✓). Read receipts are always enabled for group chats.
          </p>
        </div>

        {/* Blocked Contacts */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between p-3.5 px-4 text-xs">
            <div>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">
                Blocked Contacts
              </span>
              <span className="text-[11px] text-slate-400">
                Manage accounts you've blocked from messaging you
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-400">None</span>
          </div>
        </div>

        {/* Privacy Guarantees */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-[#2563EB] dark:text-[#14B8A6]">
            <Icon name="shield" size="sm" />
            <h5 className="text-xs font-bold uppercase tracking-wider">
              Veyra Privacy Standards
            </h5>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Your conversations, passkeys, and shared media are protected by Firestore security rules. Only participants in direct chats and group members can access conversation messages.
          </p>
        </div>
      </div>
    </div>
  );
};
