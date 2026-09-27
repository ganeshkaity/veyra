"use client";

import React, { useState, useEffect, useRef } from "react";
import { UserProfile, StatusItem, UserStatusGroup } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { subscribeToActiveStatuses } from "@/lib/firestore/statusService";
import { StatusViewerModal } from "./StatusViewerModal";
import { CreateTextStatusModal } from "./CreateTextStatusModal";
import { CreateImageStatusModal } from "./CreateImageStatusModal";

interface StatusViewProps {
  currentUser: UserProfile;
}

interface ChannelItem {
  id: string;
  name: string;
  avatar: string;
  verified: boolean;
  followers: string;
  category: string;
  description: string;
}

const CHANNELS: ChannelItem[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    avatar: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=120&auto=format&fit=crop&q=80",
    verified: true,
    followers: "152M followers",
    category: "News & Media",
    description: "The official WhatsApp Channel. Stay up to date with new features and tips.",
  },
  {
    id: "realmadrid",
    name: "Real Madrid C.F.",
    avatar: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=120&auto=format&fit=crop&q=80",
    verified: true,
    followers: "54.8M followers",
    category: "Sports team",
    description: "Welcome to the official Real Madrid Channel! #HalaMadrid",
  },
  {
    id: "tech_radar",
    name: "Tech Radar",
    avatar: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=120&auto=format&fit=crop&q=80",
    verified: true,
    followers: "12.3M followers",
    category: "Tech & Gadgets",
    description: "Daily technology news, phone releases, and AI breakthroughs.",
  },
  {
    id: "natgeo",
    name: "National Geographic",
    avatar: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=120&auto=format&fit=crop&q=80",
    verified: true,
    followers: "28.1M followers",
    category: "Nature & Wildlife",
    description: "Inspiring people to care about the planet since 1888.",
  },
];

export const StatusView: React.FC<StatusViewProps> = ({ currentUser }) => {
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [otherGroups, setOtherGroups] = useState<UserStatusGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isVideoComingSoonOpen, setIsVideoComingSoonOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isExploreChannelsOpen, setIsExploreChannelsOpen] = useState(false);
  const [followedChannelIds, setFollowedChannelIds] = useState<Set<string>>(new Set());

  // Active status story player state
  const [viewingStatuses, setViewingStatuses] = useState<StatusItem[] | null>(null);

  // Refs for capture-phase back key interception
  const isTextModalOpenRef = useRef(false);
  const isImageModalOpenRef = useRef(false);

  useEffect(() => {
    isTextModalOpenRef.current = isTextModalOpen;
  }, [isTextModalOpen]);

  useEffect(() => {
    isImageModalOpenRef.current = isImageModalOpen;
  }, [isImageModalOpen]);

  // Open status story player with zero reload & browser history entry
  const handleOpenStatusViewer = (statuses: StatusItem[], viewKey: string = "my") => {
    setViewingStatuses(statuses);

    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("view", viewKey);
      const hasViewParam = window.location.search.includes("view=");

      if (!hasViewParam && !viewingStatuses) {
        window.history.pushState({ statusViewer: viewKey }, "", currentUrl.toString());
      } else {
        window.history.replaceState({ statusViewer: viewKey }, "", currentUrl.toString());
      }
    }
  };

  // Close status story player and clean up URL
  const handleCloseStatusViewer = () => {
    setViewingStatuses(null);

    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has("view")) {
        currentUrl.searchParams.delete("view");
        window.history.replaceState({ statusViewer: null }, "", currentUrl.toString());
      }
    }
  };

  // Modal close handler: triggers history back if history entry exists
  const handleModalClose = () => {
    if (typeof window !== "undefined" && window.location.search.includes("view=")) {
      window.history.back();
    } else {
      handleCloseStatusViewer();
    }
  };

  // Listen for browser / Android Back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If text or image status modal was open, back key must only close it!
      if (isTextModalOpenRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsTextModalOpen(false);
        return;
      }
      if (isImageModalOpenRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsImageModalOpen(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");

      if (viewParam) {
        if (viewParam === "my") {
          if (myStatuses.length > 0) setViewingStatuses(myStatuses);
        } else {
          const group = otherGroups.find((g) => g.userId === viewParam);
          if (group) setViewingStatuses(group.statuses);
        }
      } else {
        // Back pressed while viewing status: close story viewer, stay on status page!
        setViewingStatuses(null);
      }
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  }, [myStatuses, otherGroups]);

  // Check for initial ?view= query param on mount
  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;

    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    if (!viewParam || viewingStatuses) return;

    if (viewParam === "my" && myStatuses.length > 0) {
      setViewingStatuses(myStatuses);
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("view");
      window.history.replaceState({ statusViewer: null }, "", cleanUrl.toString());
      window.history.pushState({ statusViewer: "my" }, "", window.location.href);
    } else if (viewParam !== "my") {
      const group = otherGroups.find((g) => g.userId === viewParam);
      if (group) {
        setViewingStatuses(group.statuses);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("view");
        window.history.replaceState({ statusViewer: null }, "", cleanUrl.toString());
        window.history.pushState({ statusViewer: viewParam }, "", window.location.href);
      }
    }
  }, [isLoading, myStatuses, otherGroups]);

  // Realtime subscription to active statuses
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToActiveStatuses(
      currentUser.uid,
      (myList, others) => {
        setMyStatuses(myList);
        setOtherGroups(others);
        setIsLoading(false);
      },
      (err) => {
        console.error("Status subscription error:", err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser.uid]);

  const toggleFollowChannel = (channelId: string) => {
    setFollowedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0B1120] overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Status
        </h1>
        <button
          onClick={() => setIsPrivacyModalOpen(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Privacy
        </button>
      </div>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-8 pb-28 md:pb-12">
        {/* ======================================================== */}
        {/* STATUS CARDS CAROUSEL (Image 1 reference layout) */}
        {/* ======================================================== */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* Card 1: Add status (Image 1 style) */}
            <div
              onClick={() => {
                if (myStatuses.length > 0) {
                  handleOpenStatusViewer(myStatuses, "my");
                } else {
                  setIsTextModalOpen(true);
                }
              }}
              className="w-[105px] h-[180px] rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-[#F1F5F9]/70 dark:bg-[#0F172A] flex flex-col items-center justify-between p-3 shadow-xs hover:shadow-md transition-all flex-shrink-0 cursor-pointer select-none active:scale-[0.98] group"
            >
              <div className="pt-2 flex flex-col items-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                    <Avatar
                      name={currentUser.displayName}
                      src={currentUser.avatarUrl}
                      size="lg"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTextModalOpen(true);
                    }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#10B981] hover:bg-emerald-600 text-white flex items-center justify-center border-2 border-white dark:border-[#0F172A] shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                    title="Add status"
                  >
                    <Icon name="add" size="xs" />
                  </button>
                </div>
              </div>

              <div className="w-full text-center pb-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight block">
                  Add
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight block">
                  status
                </span>
              </div>
            </div>

            {/* Other Contacts Story Cards (Image 1 style) */}
            {otherGroups.map((group) => {
              const latestStatus = group.statuses[0];
              const isImage = latestStatus?.type === "image" && Boolean(latestStatus?.mediaUrl);
              const previewText = latestStatus?.content || "";

              return (
                <div
                  key={group.userId}
                  onClick={() => handleOpenStatusViewer(group.statuses, group.userId)}
                  className="w-[105px] h-[180px] rounded-3xl overflow-hidden relative flex-shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all select-none group"
                  style={{
                    backgroundColor: isImage ? "#0F172A" : (latestStatus?.backgroundColor || "#7C3AED"),
                  }}
                >
                  {/* Image Background */}
                  {isImage && (
                    <img
                      src={latestStatus.mediaUrl}
                      alt={group.userDisplayName}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Gradient Overlay for Text Visibility */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85" />

                  {/* Top Avatar with Story Ring */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <div
                      className={`w-11 h-11 rounded-full p-[2px] ${
                        group.hasUnviewed
                          ? "bg-gradient-to-tr from-[#2563EB] to-[#14B8A6]"
                          : "border-2 border-white/80"
                      } flex items-center justify-center shadow-md`}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden bg-slate-900">
                        <Avatar
                          name={group.userDisplayName}
                          src={group.userAvatarUrl}
                          size="md"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Middle Snippet text */}
                  {previewText && (
                    <div className="absolute inset-x-2 top-16 bottom-11 flex items-center justify-center text-center z-10">
                      <p className="text-[11px] font-medium text-white/95 line-clamp-3 leading-snug drop-shadow-md">
                        {previewText}
                      </p>
                    </div>
                  )}

                  {/* Bottom Contact Name */}
                  <div className="absolute bottom-2.5 inset-x-2 text-center z-10">
                    <p className="text-xs font-bold text-white truncate drop-shadow-md">
                      {group.userDisplayName}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Empty placeholder card when no other statuses exist */}
            {!isLoading && otherGroups.length === 0 && (
              <div
                onClick={() => setIsImageModalOpen(true)}
                className="w-[105px] h-[180px] rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col items-center justify-center p-3 text-center flex-shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] flex items-center justify-center mb-2">
                  <Icon name="photo_camera" size="sm" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-tight">
                  Share Photo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* CHANNELS SECTION (Image 1 style with Explore button) */}
        {/* ======================================================== */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Channels
            </h2>
            <button
              type="button"
              onClick={() => setIsExploreChannelsOpen(true)}
              className="px-5 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors active:scale-95 shadow-xs"
            >
              Explore
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Stay updated on topics you care about. Find channels to follow below.
          </p>

          {/* Channels List Cards */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden shadow-xs">
            {CHANNELS.map((ch) => {
              const isFollowed = followedChannelIds.has(ch.id);
              return (
                <div
                  key={ch.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-3">
                    <img
                      src={ch.avatar}
                      alt={ch.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {ch.name}
                        </h4>
                        {ch.verified && (
                          <span className="text-[#2563EB] text-xs">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {ch.followers} • {ch.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFollowChannel(ch.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 active:scale-95 ${
                      isFollowed
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        : "bg-[#2563EB] text-white hover:bg-blue-700 shadow-xs"
                    }`}
                  >
                    {isFollowed ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* Story Viewer Modal */}
      {viewingStatuses && viewingStatuses.length > 0 && (
        <StatusViewerModal
          isOpen={true}
          onClose={handleModalClose}
          statuses={viewingStatuses}
          currentUser={currentUser}
          onStatusDeleted={(deletedId) => {
            setMyStatuses((prev) => prev.filter((s) => s.id !== deletedId));
          }}
        />
      )}

      {/* Create Text Status Modal (Matching Image 2) */}
      <CreateTextStatusModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        currentUser={currentUser}
        onSwitchToPhoto={() => {
          setIsTextModalOpen(false);
          setIsImageModalOpen(true);
        }}
        onSwitchToVideo={() => setIsVideoComingSoonOpen(true)}
      />

      {/* Create Image Status Modal */}
      <CreateImageStatusModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Explore Channels Modal */}
      <Modal
        isOpen={isExploreChannelsOpen}
        onClose={() => setIsExploreChannelsOpen(false)}
        title="Explore Channels"
        maxWidth="md"
      >
        <div className="space-y-3 p-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Browse verified channels from news, sports, entertainment, and organizations.
          </p>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {CHANNELS.map((ch) => {
              const isFollowed = followedChannelIds.has(ch.id);
              return (
                <div key={ch.id} className="pt-3 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={ch.avatar}
                      alt={ch.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-1 font-bold text-sm text-slate-800 dark:text-slate-200">
                        <span>{ch.name}</span>
                        {ch.verified && <span className="text-[#2563EB]">✓</span>}
                      </div>
                      <p className="text-xs text-slate-400">{ch.followers}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollowChannel(ch.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      isFollowed
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        : "bg-[#2563EB] text-white hover:bg-blue-700"
                    }`}
                  >
                    {isFollowed ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button size="sm" onClick={() => setIsExploreChannelsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Video Status Coming Soon Modal */}
      <Modal
        isOpen={isVideoComingSoonOpen}
        onClose={() => setIsVideoComingSoonOpen(false)}
        title="Video Status"
        maxWidth="sm"
      >
        <div className="text-center space-y-3 p-2">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <Icon name="videocam" size="md" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              Coming Soon in V2
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Video Status Updates
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              High-definition short video stories with trimming and sound controls are coming in Veyra V2.
            </p>
          </div>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsVideoComingSoonOpen(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      {/* Privacy Info Modal */}
      <Modal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        title="Status Privacy"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            Your status updates are visible to authenticated Veyra users who have conversations with you.
          </p>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              Automatic 24-Hour Expiration
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Every status item automatically expires and disappears 24 hours after publishing.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setIsPrivacyModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
