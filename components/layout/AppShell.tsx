"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { DesktopSidebarNav } from "@/components/chat/DesktopSidebarNav";
import { MobileBottomNav } from "@/components/chat/MobileBottomNav";
import { NavigationTab } from "@/constants/brand";

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: NavigationTab;
}

export const AppShell: React.FC<AppShellProps> = ({ children, activeTab }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, isEmailVerified, is2FAPending } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    if (!isEmailVerified) {
      router.replace("/auth?mode=verify-email");
      return;
    }

    if (is2FAPending) {
      router.replace("/auth");
      return;
    }

    if (!profile) {
      router.replace("/auth?mode=onboarding");
      return;
    }
  }, [user, profile, loading, isEmailVerified, is2FAPending, router]);

  const currentTab: NavigationTab =
    activeTab ||
    (pathname.startsWith("/status")
      ? "status"
      : pathname.startsWith("/groups")
      ? "groups"
      : pathname.startsWith("/profile")
      ? "you"
      : pathname.startsWith("/setting")
      ? "settings"
      : "chats");

  const handleTabChange = (tab: NavigationTab) => {
    if (tab === "chats") router.push("/chat");
    else if (tab === "status") router.push("/status");
    else if (tab === "groups") router.push("/groups");
    else if (tab === "you") router.push("/profile");
    else if (tab === "settings") router.push("/setting");
  };

  const handleOpenAi = () => {
    router.push("/chat?ai=true");
  };

  if (loading || !user || !profile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-[#0B1120]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading Veyra...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0B1120]">
      <DesktopSidebarNav
        activeTab={currentTab}
        onTabChange={handleTabChange}
        onOpenAi={handleOpenAi}
      />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden pb-16 md:pb-0">
        {children}
      </main>
      <MobileBottomNav
        activeTab={currentTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
};
