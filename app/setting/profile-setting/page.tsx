"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileSection } from "@/components/settings/sections/ProfileSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingProfileSettingPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <ProfileSection
        currentUser={profile}
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
