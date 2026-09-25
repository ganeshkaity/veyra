"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { NotificationsSection } from "@/components/settings/sections/NotificationsSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingNotificationPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <NotificationsSection
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
