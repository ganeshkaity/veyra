"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ManageListsSection } from "@/components/settings/sections/ManageListsSection";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ManageChatListsPage() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="settings">
      <ManageListsSection
        currentUser={profile}
        onBack={() => router.push("/setting")}
      />
    </AppShell>
  );
}
