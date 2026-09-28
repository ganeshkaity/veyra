"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import {
  subscribeToAllChannels,
  subscribeToUserFollowedChannels,
  followChannel,
  unfollowChannel,
  seedInitialChannelsIfEmpty,
  formatFollowerCount,
} from "@/lib/firestore/channelService";
import { Channel } from "@/types";
import { CreateChannelModal } from "@/components/channel/CreateChannelModal";

export default function ExploreChannelsPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Seed default channels if empty
  useEffect(() => {
    seedInitialChannelsIfEmpty();
  }, []);

  // Subscribe to up to 50 channels from Firestore
  useEffect(() => {
    const unsub = subscribeToAllChannels((list) => {
      setChannels(list);
      setIsLoading(false);
    }, 50);

    return () => unsub();
  }, []);

  // Subscribe to user followed channel IDs
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserFollowedChannels(user.uid, (list) => {
      setFollowedIds(new Set(list.map((c) => c.id)));
    });

    return () => unsub();
  }, [user]);

  // Handle follow / unfollow toggle
  const handleToggleFollow = async (e: React.MouseEvent, channel: Channel) => {
    e.stopPropagation();
    if (!user || !profile) {
      router.push("/auth");
      return;
    }

    const isFollowing = followedIds.has(channel.id);
    try {
      if (isFollowing) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(channel.id);
          return next;
        });
        await unfollowChannel(channel.id, user.uid);
      } else {
        setFollowedIds((prev) => new Set(prev).add(channel.id));
        await followChannel(channel.id, profile);
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>(["All"]);
    channels.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [channels]);

  const filteredChannels = useMemo(() => {
    let result = channels;
    if (selectedCategory !== "All") {
      result = result.filter((c) => c.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          (c.category && c.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [channels, searchQuery, selectedCategory]);

  return (
    <AppShell activeTab="status">
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0B1120] overflow-y-auto">
        {/* Top Header */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/status")}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Back to Updates"
              aria-label="Back to Updates"
            >
              <Icon name="arrow_back" size="sm" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Explore Channels
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Discover and follow verified channels to stay updated
              </p>
            </div>
          </div>

          {/* Create Channel Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Icon name="add" size="xs" />
            <span>Create Channel</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-6 pb-28 md:pb-12">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Icon name="search" size="sm" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels by name, topic or keywords..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          {categories.length > 2 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Channel Results Count */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Showing {filteredChannels.length} {filteredChannels.length === 1 ? "channel" : "channels"}
            </span>
            <span>Tap channel to open updates</span>
          </div>

          {/* Channel Cards List */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden shadow-xs">
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading channels...</span>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Icon name="campaign" size="md" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No channels found
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    Try different keywords or create your own channel to share updates with the world.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-5 py-2 rounded-full bg-[#2563EB] text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Create Channel
                </button>
              </div>
            ) : (
              filteredChannels.map((ch) => {
                const isFollowed = followedIds.has(ch.id);
                return (
                  <div
                    key={ch.id}
                    onClick={() => router.push(`/channel?channel-id=${ch.id}`)}
                    className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-3">
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {ch.avatarUrl || ch.avatar ? (
                          <img
                            src={ch.avatarUrl || ch.avatar}
                            alt={ch.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-xl uppercase">
                            {ch.name.charAt(0) || "C"}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                            {ch.name}
                          </h3>
                          {ch.verified && (
                            <span
                              className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] font-black flex items-center justify-center flex-shrink-0"
                              title="Verified Channel"
                            >
                              ✓
                            </span>
                          )}
                          {ch.category && (
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-medium ml-1">
                              {ch.category}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-md">
                          {formatFollowerCount(ch.followerCount)}
                          {ch.description ? ` • ${ch.description}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Follow / Following Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleFollow(e, ch)}
                      className={`px-4 sm:px-5 py-2 rounded-full text-xs font-bold transition-all flex-shrink-0 active:scale-95 shadow-xs ${
                        isFollowed
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                          : "bg-[#2563EB] text-white hover:bg-blue-700"
                      }`}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Create Channel Modal */}
        <CreateChannelModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onChannelCreated={(newChan) => {
            setIsCreateModalOpen(false);
            router.push(`/channel?channel-id=${newChan.id}`);
          }}
        />
      </div>
    </AppShell>
  );
}
