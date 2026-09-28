"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Channel } from "@/types";
import { subscribeToChannel } from "@/lib/firestore/channelService";
import { ChannelView } from "@/components/channel/ChannelView";
import { Icon } from "@/components/ui/Icon";

function ChannelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const channelId = searchParams.get("channel-id") || "";
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!channelId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToChannel(channelId, (ch) => {
      setChannel(ch);
      setIsLoading(false);
    });

    return () => unsub();
  }, [channelId]);

  if (loading || isLoading) {
    return (
      <AppShell activeTab="status">
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#EFEAE2] dark:bg-[#0B141A]">
          <div className="w-10 h-10 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Opening channel updates...</p>
        </div>
      </AppShell>
    );
  }

  if (!channel) {
    return (
      <AppShell activeTab="status">
        <div className="flex-1 flex flex-col items-center justify-center h-full p-6 bg-slate-50 dark:bg-[#0B1120] text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-slate-200/80 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-4">
            <Icon name="campaign" size="lg" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
            Channel not found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
            This channel may have been removed, or the link is invalid.
          </p>
          <button
            onClick={() => router.push("/status")}
            className="px-6 py-2.5 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all"
          >
            Back to Updates
          </button>
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <AppShell activeTab="status">
      <ChannelView
        channel={channel}
        currentUser={profile}
        onBack={() => router.push("/status")}
      />
    </AppShell>
  );
}

export default function ChannelPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#EFEAE2] dark:bg-[#0B141A]">
          <div className="w-10 h-10 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading channel...</p>
        </div>
      }
    >
      <ChannelContent />
    </Suspense>
  );
}
