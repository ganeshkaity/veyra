"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StorageSection } from "@/components/settings/sections/StorageSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingDataAndStorageUsagePage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <StorageSection
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
