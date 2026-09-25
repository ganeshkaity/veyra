"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/components/profile/ProfileView";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ProfilePage() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="you">
      <ProfileView currentUser={profile} />
    </AppShell>
  );
}
