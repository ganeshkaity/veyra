"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SecuritySection } from "@/components/settings/sections/SecuritySection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AccountSecurityPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <SecuritySection
        currentUser={profile}
        onBack={() => router.push("/setting/account")}
        onNavigateToTwoStep={() => router.push("/setting/account/two-step-verification")}
      />
    </AppShell>
  );
}
