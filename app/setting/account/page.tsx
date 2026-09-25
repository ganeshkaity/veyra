"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AccountSettingPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  const handleNavigateSection = (section: string) => {
    switch (section) {
      case "privacy":
        router.push("/setting/account/privacy");
        break;
      case "security":
        router.push("/setting/account/security");
        break;
      case "twostep":
        router.push("/setting/account/two-step-verification");
        break;
      case "changenumber":
        router.push("/setting/account/change-number");
        break;
      default:
        router.push(`/setting/${section}`);
        break;
    }
  };

  return (
    <AppShell activeTab="settings">
      <AccountSection
        currentUser={profile}
        onBack={() => router.push("/setting")}
        onNavigateToSection={handleNavigateSection}
      />
    </AppShell>
  );
}
