"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ChangeNumberSection } from "@/components/settings/sections/ChangeNumberSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AccountChangeNumberPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <ChangeNumberSection
        currentUser={profile}
        onBack={() => router.push("/setting/account")}
      />
    </AppShell>
  );
}
