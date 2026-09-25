"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TwoStepSection } from "@/components/settings/sections/TwoStepSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingTwoStepVerificationPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <TwoStepSection
        currentUser={profile}
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
