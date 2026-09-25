"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AppearanceSection } from "@/components/settings/sections/AppearanceSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingAppearancePage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <AppearanceSection
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
