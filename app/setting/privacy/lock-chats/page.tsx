"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LockChatSection } from "@/components/settings/sections/LockChatSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function LockChatsSettingPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <LockChatSection
        currentUser={profile}
        onBack={() => router.push("/setting/privacy")}
      />
    </AppShell>
  );
}
