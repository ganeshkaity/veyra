"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AboutSection } from "@/components/settings/sections/AboutSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingAboutPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <AboutSection
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
