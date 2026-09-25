"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { HelpSection } from "@/components/settings/sections/HelpSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingHelpPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <HelpSection
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
