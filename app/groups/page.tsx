"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { GroupsView } from "@/components/groups/GroupsView";
import { useAuth } from "@/components/providers/AuthProvider";
import { subscribeToConversations } from "@/lib/firestore/conversationService";
import { Conversation } from "@/types";

export default function GroupsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToConversations(
      profile.uid,
      (convos) => {
        setConversations(convos);
      },
      (err) => {
        console.error("Failed to load group conversations:", err);
      }
    );
    return () => unsub();
  }, [profile?.uid]);

  if (!profile) return null;

  return (
    <AppShell activeTab="groups">
      <GroupsView
        currentUser={profile}
        conversations={conversations}
        onSelectGroupConversation={(groupId) => {
          router.push(`/chat?chat=${groupId}`);
        }}
      />
    </AppShell>
  );
}
