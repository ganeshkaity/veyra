"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusView } from "@/components/status/StatusView";
import { useAuth } from "@/components/providers/AuthProvider";

export default function StatusPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AppShell activeTab="status">
      <StatusView currentUser={profile} />
    </AppShell>
  );
}
