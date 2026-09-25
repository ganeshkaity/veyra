"use client";

import React, { useState } from "react";
import Image from "next/image";
import { UserProfile } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";

// Section Views
import { AccountSection } from "./sections/AccountSection";
import { PrivacySection } from "./sections/PrivacySection";
import { SecuritySection } from "./sections/SecuritySection";
import { TwoStepSection } from "./sections/TwoStepSection";
import { ChatsSection } from "./sections/ChatsSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { StorageSection } from "./sections/StorageSection";
import { HelpSection } from "./sections/HelpSection";
import { AboutSection } from "./sections/AboutSection";
import { ProfileSection } from "./sections/ProfileSection";

interface SettingsViewProps {
  currentUser: UserProfile;
  initialSection?: string | null;
  onNavigate?: (path: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  initialSection = null,
  onNavigate,
}) => {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const [activeSection, setActiveSection] = useState<string | null>(initialSection);

  const handleSelectSection = (section: string, routePath: string) => {
    if (onNavigate) {
      onNavigate(routePath);
    } else {
      setActiveSection(section);
    }
  };

  // Render Subpages
  if (activeSection === "profile") {
    return <ProfileSection currentUser={currentUser} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "account") {
    return (
      <AccountSection
        currentUser={currentUser}
        onBack={() => setActiveSection(null)}
        onNavigateToSection={(section) => setActiveSection(section)}
      />
    );
  }
  if (activeSection === "privacy") {
    return <PrivacySection currentUser={currentUser} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "security") {
    return (
      <SecuritySection
        currentUser={currentUser}
        onBack={() => setActiveSection(null)}
        onNavigateToTwoStep={() => setActiveSection("twostep")}
      />
    );
  }
  if (activeSection === "twostep") {
    return <TwoStepSection currentUser={currentUser} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "chats") {
    return <ChatsSection currentUser={currentUser} onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "appearance") {
    return <AppearanceSection onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "notifications") {
    return <NotificationsSection onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "storage") {
    return <StorageSection onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "help") {
    return <HelpSection onBack={() => setActiveSection(null)} />;
  }
  if (activeSection === "about") {
    return <AboutSection onBack={() => setActiveSection(null)} />;
  }

  // Main Settings Hub (Inspired by reference UI media_1790281933724.png)
  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120] overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings
        </h2>
      </div>

      <div className="p-4 max-w-lg mx-auto w-full space-y-5 pb-24 md:pb-12">
        {/* User Profile Card (Top Header Card matching reference UI) */}
        <button
          type="button"
          onClick={() => handleSelectSection("profile", "/setting/profile-setting")}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <Avatar
              name={currentUser.displayName}
              src={currentUser.avatarUrl}
              size="lg"
            />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-[#2563EB] dark:group-hover:text-[#14B8A6] transition-colors">
                {currentUser.displayName}
              </h3>
              <p className="text-xs text-[#2563EB] dark:text-[#14B8A6] font-mono font-medium truncate">
                @{currentUser.username}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[200px] sm:max-w-xs">
                {currentUser.bio || "Har Baat, Apno Ke Saath."}
              </p>
            </div>
          </div>
          <Icon name="chevron_right" size="sm" className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Group 1: Account, Privacy, Security & 2FA */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#0F172A] shadow-xs">
          {/* Account */}
          <button
            type="button"
            onClick={() => handleSelectSection("account", "/setting/account")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center flex-shrink-0">
                <Icon name="key" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Account
                </h4>
                <p className="text-[11px] text-slate-400">
                  Change number, request info, delete account
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          {/* Privacy */}
          <button
            type="button"
            onClick={() => handleSelectSection("privacy", "/setting/privacy")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
                <Icon name="lock" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Privacy
                </h4>
                <p className="text-[11px] text-slate-400">
                  Read receipts, blocked contacts
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          {/* Security */}
          <button
            type="button"
            onClick={() => handleSelectSection("security", "/setting/security")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Icon name="shield" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Security
                </h4>
                <p className="text-[11px] text-slate-400">
                  Password management, linked Google account
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          {/* Two-Step Verification */}
          <button
            type="button"
            onClick={() => handleSelectSection("twostep", "/setting/two-step-verification")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <Icon name="verified_user" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Two-Step Verification
                </h4>
                <p className="text-[11px] text-slate-400">
                  Email OTP login protection
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  currentUser.twoFactorEnabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {currentUser.twoFactorEnabled ? "Enabled" : "Disabled"}
              </span>
              <Icon name="chevron_right" size="sm" className="text-slate-400" />
            </div>
          </button>
        </div>

        {/* Group 2: Chats, Appearance, Notifications, Data/Storage */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#0F172A] shadow-xs">
          {/* Chats */}
          <button
            type="button"
            onClick={() => handleSelectSection("chats", "/setting/chats")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-[#14B8A6] flex items-center justify-center flex-shrink-0">
                <Icon name="chat" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Chats
                </h4>
                <p className="text-[11px] text-slate-400">
                  Chat wallpaper, enter is send, chat history
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          {/* Appearance */}
          <button
            type="button"
            onClick={() => handleSelectSection("appearance", "/setting/appearance")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                <Icon name="palette" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Appearance
                </h4>
                <p className="text-[11px] text-slate-400">
                  Theme mode: {theme === "dark" ? "Dark" : "Light"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 capitalize">
                {theme === "dark" ? "Dark" : "Light"}
              </span>
              <Icon name="chevron_right" size="sm" className="text-slate-400" />
            </div>
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => handleSelectSection("notifications", "/setting/notification")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <Icon name="notifications" size="xs" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Notifications
                  </h4>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    Coming Soon
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Push & in-app alerts
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          {/* Data and Storage Usage */}
          <button
            type="button"
            onClick={() => handleSelectSection("storage", "/setting/data-and-storage-usage")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Icon name="swap_vert" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Data and Storage Usage
                </h4>
                <p className="text-[11px] text-slate-400">
                  Network usage, local cache controls
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>
        </div>

        {/* Group 3: Help & About */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#0F172A] shadow-xs">
          {/* Help */}
          <button
            type="button"
            onClick={() => handleSelectSection("help", "/setting/help")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                <Icon name="help" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Help
                </h4>
                <p className="text-[11px] text-slate-400">
                  FAQ, contact support, system status
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          {/* About */}
          <button
            type="button"
            onClick={() => handleSelectSection("about", "/setting/about")}
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#2563EB] dark:text-[#14B8A6] flex items-center justify-center flex-shrink-0">
                <Icon name="info" size="xs" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  About
                </h4>
                <p className="text-[11px] text-slate-400">
                  Veyra v1.0.0, Har Baat, Apno Ke Saath.
                </p>
              </div>
            </div>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>
        </div>

        {/* Log Out Button */}
        <div className="pt-2">
          <Button
            variant="ghost"
            size="md"
            onClick={logout}
            className="w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            leftIcon={<Icon name="logout" size="sm" />}
          >
            Log Out
          </Button>
        </div>

        {/* Brand Footer Note */}
        <div className="pt-4 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 opacity-60">
            <div className="w-4 h-4 rounded overflow-hidden">
              <Image
                src="/assets/main_logo.png"
                alt="Veyra"
                width={16}
                height={16}
                className="object-contain"
              />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Veyra
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            "Har Baat, Apno Ke Saath."
          </p>
        </div>
      </div>
    </div>
  );
};
