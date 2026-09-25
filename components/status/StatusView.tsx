"use client";

import React, { useState, useEffect } from "react";
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

export const StatusView: React.FC<StatusViewProps> = ({ currentUser }) => {
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [otherGroups, setOtherGroups] = useState<UserStatusGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isVideoComingSoonOpen, setIsVideoComingSoonOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Active status story player state
  const [viewingStatuses, setViewingStatuses] = useState<StatusItem[] | null>(null);

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
    const handlePopState = () => {
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

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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

  // Viewed updates collapse toggle
  const [showViewedUpdates, setShowViewedUpdates] = useState(true);

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

  // Separate recent unviewed vs viewed groups
  const recentGroups = otherGroups.filter((g) => g.hasUnviewed);
  const viewedGroups = otherGroups.filter((g) => !g.hasUnviewed);

  // Helper formatting for timestamps
  const formatTime = (ts: number) => {
    const now = Date.now();
    const diffHours = (now - ts) / (1000 * 60 * 60);
    if (diffHours < 1) {
      const mins = Math.max(1, Math.floor((now - ts) / (1000 * 60)));
      return `${mins}m ago`;
    }
    return new Date(ts).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getExpirationBadge = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return "Expired";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h left`;
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${mins}m left`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120] overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={() => setIsPrivacyModalOpen(true)}
          className="text-xs font-semibold text-[#2563EB] dark:text-[#14B8A6] hover:opacity-80 transition-opacity"
        >
          Privacy
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-6">
          Status
        </h2>
      </div>

      <div className="p-4 max-w-lg mx-auto w-full space-y-6 pb-24 md:pb-8">
        {/* ======================================================== */}
        {/* MY STATUS CARD (matches reference UI media_1790281940732.png) */}
        {/* ======================================================== */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div
            onClick={() => {
              if (myStatuses.length > 0) {
                handleOpenStatusViewer(myStatuses, "my");
              } else {
                setIsTextModalOpen(true);
              }
            }}
            className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer group"
          >
            <div className="relative flex-shrink-0 flex items-center justify-center">
              {myStatuses.length > 0 ? (
                /* Segmented or gradient story ring */
                <div className="w-[62px] h-[62px] rounded-full p-[2.5px] bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] flex items-center justify-center flex-shrink-0 shadow-xs">
                  <div className="w-full h-full rounded-full p-[2px] bg-white dark:bg-[#0F172A] flex items-center justify-center">
                    <Avatar
                      name={currentUser.displayName}
                      src={currentUser.avatarUrl}
                      size="lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0">
                  <Avatar
                    name={currentUser.displayName}
                    src={currentUser.avatarUrl}
                    size="lg"
                  />
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center border-2 border-white dark:border-[#0F172A] shadow-xs">
                    <Icon name="add" size="xs" />
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-[#2563EB] dark:group-hover:text-[#14B8A6] transition-colors">
                My Status
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {myStatuses.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span>{myStatuses.length} active update{myStatuses.length > 1 ? "s" : ""}</span>
                    <span>•</span>
                    <span className="text-teal-600 dark:text-teal-400 font-medium">
                      {getExpirationBadge(myStatuses[0].expiresAt)}
                    </span>
                  </span>
                ) : (
                  "Add to my status"
                )}
              </p>
            </div>
          </div>

          {/* Quick Create Buttons: Photo & Text & Video */}
          <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
            <button
              type="button"
              onClick={() => setIsImageModalOpen(true)}
              className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#60A5FA] hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors active:scale-95"
              title="Add photo status"
            >
              <Icon name="photo_camera" size="sm" />
            </button>
            <button
              type="button"
              onClick={() => setIsTextModalOpen(true)}
              className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-[#14B8A6] hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors active:scale-95"
              title="Add text status"
            >
              <Icon name="edit" size="sm" />
            </button>
            <button
              type="button"
              onClick={() => setIsVideoComingSoonOpen(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors active:scale-95"
              title="Video status (Coming Soon)"
            >
              <Icon name="videocam" size="sm" />
            </button>
          </div>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* RECENT UPDATES (UNVIEWED) */}
        {/* ======================================================== */}
        {!isLoading && recentGroups.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Recent Updates ({recentGroups.length})
            </h4>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
              {recentGroups.map((group) => (
                <button
                  key={group.userId}
                  type="button"
                  onClick={() => handleOpenStatusViewer(group.statuses, group.userId)}
                  className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Vibrant ring indicating unviewed status */}
                    <div className="w-[50px] h-[50px] rounded-full p-[2px] bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] flex items-center justify-center flex-shrink-0 shadow-xs">
                      <div className="w-full h-full rounded-full p-[1.5px] bg-white dark:bg-[#0F172A] flex items-center justify-center">
                        <Avatar
                          name={group.userDisplayName}
                          src={group.userAvatarUrl}
                          size="md"
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {group.userDisplayName}
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                        <span>{formatTime(group.latestTimestamp)}</span>
                        <span>•</span>
                        <span className="text-[#2563EB] dark:text-[#14B8A6] font-medium">
                          {getExpirationBadge(group.statuses[0].expiresAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Icon name="chevron_right" size="sm" className="text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEWED UPDATES */}
        {/* ======================================================== */}
        {!isLoading && viewedGroups.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowViewedUpdates(!showViewedUpdates)}
              className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <span>Viewed Updates ({viewedGroups.length})</span>
              <Icon
                name={showViewedUpdates ? "expand_less" : "expand_more"}
                size="xs"
              />
            </button>

            {showViewedUpdates && (
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
                {viewedGroups.map((group) => (
                  <button
                    key={group.userId}
                    type="button"
                    onClick={() => handleOpenStatusViewer(group.statuses, group.userId)}
                    className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors opacity-80 hover:opacity-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Subtle ring for viewed status */}
                      <div className="w-[50px] h-[50px] rounded-full p-[2px] border-2 border-slate-300/80 dark:border-slate-700 flex items-center justify-center flex-shrink-0">
                        <div className="w-full h-full rounded-full p-[1.5px] bg-white dark:bg-[#0F172A] flex items-center justify-center">
                          <Avatar
                            name={group.userDisplayName}
                            src={group.userAvatarUrl}
                            size="md"
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {group.userDisplayName}
                        </h5>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {formatTime(group.latestTimestamp)}
                        </p>
                      </div>
                    </div>
                    <Icon name="chevron_right" size="sm" className="text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* EMPTY STATE (matches reference UI media_1790281940732.png) */}
        {/* ======================================================== */}
        {!isLoading && otherGroups.length === 0 && (
          <div className="p-8 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A]/50 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Icon name="donut_large" size="md" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No recent updates to show right now.
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              When your contacts share photos or thoughts, their updates will appear here and automatically disappear after 24 hours.
            </p>
          </div>
        )}
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

      {/* Create Text Status Modal */}
      <CreateTextStatusModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Create Image Status Modal */}
      <CreateImageStatusModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        currentUser={currentUser}
      />

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
