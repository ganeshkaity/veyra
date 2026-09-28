"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CallsView } from "@/components/calls/CallsView";
import { useAuth } from "@/components/providers/AuthProvider";

export default function CallsPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="calls">
      <CallsView currentUser={profile} />
    </AppShell>
  );
}
