"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsView } from "@/components/settings/SettingsView";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <SettingsView
        currentUser={profile}
        onNavigate={(path) => router.push(path)}
      />
    </AppShell>
  );
}
