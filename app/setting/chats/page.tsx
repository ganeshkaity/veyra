"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ChatsSection } from "@/components/settings/sections/ChatsSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingChatsPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <ChatsSection
        currentUser={profile}
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
