"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PrivacySection } from "@/components/settings/sections/PrivacySection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingPrivacyPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <PrivacySection
        currentUser={profile}
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
