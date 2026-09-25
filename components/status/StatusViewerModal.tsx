"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { StatusItem, UserProfile } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import {
  recordStatusView,
  deleteStatus,
  toggleStatusHeart,
} from "@/lib/firestore/statusService";
import { FallingHeartsAnimation } from "./FallingHeartsAnimation";
import { StatusViewersDrawer } from "./StatusViewersDrawer";

interface StatusViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: StatusItem[];
  currentUser: UserProfile;
  onStatusDeleted?: (statusId: string) => void;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  isOpen,
  onClose,
  statuses,
  currentUser,
  onStatusDeleted,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHeartsAnimation, setShowHeartsAnimation] = useState(false);
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);

  const durationMs = 5000; // 5 seconds per status
  const intervalStepMs = 50;

  // Reset index when opened with a new set of statuses
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setProgress(0);
      setIsPaused(false);
      setShowHeartsAnimation(false);
      setShowViewersDrawer(false);
    }
  }, [isOpen, statuses]);

  const currentStatus: StatusItem | undefined = statuses[currentIndex];
  const isOwner = currentStatus?.userId === currentUser.uid;

  // Record view in Firestore with viewer profile info when status changes
  useEffect(() => {
    if (isOpen && currentStatus && !isOwner) {
      recordStatusView(currentStatus.id, {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      });
    }
  }, [isOpen, currentStatus?.id, isOwner, currentUser]);

  const hasHearted = Boolean(
    currentStatus?.heartBy?.includes(currentUser.uid) ||
      currentStatus?.hearts?.some((h) => h.userId === currentUser.uid)
  );

  const handleToggleHeart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStatus) return;
    // Always trigger cascading falling hearts animation
    setShowHeartsAnimation(true);
    await toggleStatusHeart(currentStatus.id, {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl,
    });
  };

  // Handle timer auto-advance (only increments progress)
  useEffect(() => {
    if (
      !isOpen ||
      !currentStatus ||
      isPaused ||
      showDeleteConfirm ||
      showViewersDrawer
    )
      return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (intervalStepMs / durationMs) * 100;
        return next > 100 ? 100 : next;
      });
    }, intervalStepMs);

    return () => clearInterval(timer);
  }, [isOpen, currentStatus, isPaused, showDeleteConfirm]);

  // Advance to next status or close when progress reaches 100% in a clean effect
  useEffect(() => {
    if (progress >= 100) {
      if (currentIndex < statuses.length - 1) {
        setCurrentIndex((idx) => idx + 1);
        setProgress(0);
      } else {
        onClose();
      }
    }
  }, [progress, currentIndex, statuses.length, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === " ") {
        setIsPaused((p) => !p);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, statuses.length]);

  if (!isOpen || !currentStatus) return null;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1);
      setProgress(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex((idx) => idx + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!currentStatus) return;
    try {
      setIsDeleting(true);
      await deleteStatus(currentStatus.id);
      onStatusDeleted?.(currentStatus.id);
      setShowDeleteConfirm(false);
      if (statuses.length <= 1) {
        onClose();
      } else {
        handleNext();
      }
    } catch (err) {
      console.error("Failed to delete status:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Expiration calculation
  const getExpirationText = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return "Expired";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) return `Expires in ${hours}h`;
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `Expires in ${mins}m`;
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const isHoldingRef = useRef(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = () => {
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setIsPaused(true);
    }, 220);
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setIsPaused(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-in fade-in duration-200">
      {/* Container simulating mobile story viewport */}
      <div
        className="relative w-full h-full max-w-md max-h-[92vh] sm:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl"
        style={{
          backgroundColor:
            currentStatus.type === "text"
              ? currentStatus.backgroundColor || "#2563EB"
              : "#0B1120",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Top Progress Bars (One segment per status in group) */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-4 space-y-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-1.5 w-full">
            {statuses.map((s, idx) => {
              let segmentProgress = 0;
              if (idx < currentIndex) segmentProgress = 100;
              else if (idx === currentIndex) segmentProgress = progress;

              return (
                <div
                  key={s.id}
                  className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
                >
                  <div
                    className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
                    style={{ width: `${segmentProgress}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Avatar
                name={currentStatus.userDisplayName}
                src={currentStatus.userAvatarUrl}
                size="md"
                className="ring-2 ring-white/50"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold truncate max-w-[160px]">
                    {currentStatus.userDisplayName}
                  </h4>
                  <span className="text-[10px] text-white/70 font-mono">
                    @{currentStatus.userUsername}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/80">
                  <span>{formatTimestamp(currentStatus.createdAt)}</span>
                  <span>•</span>
                  <span className="text-teal-300 font-medium">
                    {getExpirationText(currentStatus.expiresAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Play/Pause, Delete (if owner), Close */}
            <div className="flex items-center gap-1">
              {/* Play/Pause Story Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(!isPaused);
                }}
                className="p-2 rounded-full text-white/90 hover:text-white hover:bg-white/15 transition-colors active:scale-95"
                title={isPaused ? "Play story (Space)" : "Pause story (Space)"}
                aria-label={isPaused ? "Play story" : "Pause story"}
              >
                <Icon name={isPaused ? "play_arrow" : "pause"} size="sm" />
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  title="Delete this status"
                >
                  <Icon name="delete" size="sm" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Close"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Paused Floating Badge */}
        {isPaused && !showDeleteConfirm && !showViewersDrawer && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/95 text-xs font-semibold flex items-center gap-1.5 shadow-lg border border-white/15 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Paused</span>
          </div>
        )}

        {/* Cascading Falling Hearts Shower Animation */}
        <FallingHeartsAnimation
          active={showHeartsAnimation}
          onComplete={() => setShowHeartsAnimation(false)}
        />

        {/* Story Center Media / Content Area */}
        <div className="relative flex-1 flex items-center justify-center p-6 z-10 overflow-hidden">
          {currentStatus.type === "image" && currentStatus.mediaUrl ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <div className="relative w-full h-[70vh] flex items-center justify-center">
                <Image
                  src={currentStatus.mediaUrl}
                  alt="Status photo"
                  fill
                  className="object-contain"
                  priority
                  unoptimized
                />
              </div>
              {currentStatus.content && (
                <div className="absolute bottom-6 max-w-sm px-4 py-2.5 rounded-2xl bg-black/70 backdrop-blur-md text-white text-sm text-center font-medium shadow-lg">
                  {currentStatus.content}
                </div>
              )}
            </div>
          ) : (
            /* Text Status */
            <div className="text-center px-6 max-w-sm text-white">
              <p className="text-2xl sm:text-3xl font-extrabold leading-relaxed whitespace-pre-wrap drop-shadow-md">
                {currentStatus.content}
              </p>
            </div>
          )}
        </div>

        {/* Touch & Click Navigation Tap Zones (3 zones: Prev | Play/Pause | Next) */}
        <div className="absolute inset-0 z-20 flex">
          {/* Left Zone (25%): Previous Status */}
          <div
            className="w-1/4 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (isHoldingRef.current) return;
              handlePrev();
            }}
            title="Previous status"
          />

          {/* Middle Zone (50%): Pause / Resume Story (Does NOT close the status) */}
          <div
            className="w-1/2 h-full cursor-pointer flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              if (isHoldingRef.current) return;
              setIsPaused((p) => !p);
            }}
            title={isPaused ? "Tap to play" : "Tap to pause"}
          />

          {/* Right Zone (25%): Next Status */}
          <div
            className="w-1/4 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (isHoldingRef.current) return;
              handleNext();
            }}
            title="Next status"
          />
        </div>

        {/* Bottom Reaction Bar (When viewing another user's status) */}
        {!isOwner && (
          <div className="relative z-30 p-3 px-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-between gap-3">
            <div className="flex-1 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/75 select-none">
              <span>Status by {currentStatus.userDisplayName}</span>
            </div>

            {/* Heart Reaction Button */}
            <button
              type="button"
              onClick={handleToggleHeart}
              className={`p-3 rounded-full transition-all active:scale-125 duration-150 flex items-center justify-center shadow-xl ${
                hasHearted
                  ? "bg-rose-500/25 text-rose-500 ring-2 ring-rose-500/60 scale-105"
                  : "bg-white/15 hover:bg-white/25 text-white/90 hover:text-rose-400 border border-white/20"
              }`}
              title={hasHearted ? "Remove heart reaction" : "Give heart reaction ❤️"}
              aria-label="Heart reaction"
            >
              <Icon
                name="favorite"
                size="sm"
                fill={hasHearted}
                className={hasHearted ? "text-rose-500" : ""}
              />
            </button>
          </div>
        )}

        {/* Bottom Footer (Owner views count & tap to open drawer) */}
        {isOwner && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPaused(true);
              setShowViewersDrawer(true);
            }}
            className="relative z-30 p-3.5 px-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-center text-white text-xs gap-2 font-medium hover:opacity-95 active:scale-95 transition-all w-full cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 shadow-md">
              <Icon name="visibility" size="xs" />
              <span>
                {currentStatus.viewers && currentStatus.viewers.length > 1
                  ? `${currentStatus.viewers.length - 1} ${
                      currentStatus.viewers.length - 1 === 1 ? "view" : "views"
                    }`
                  : "0 views"}
              </span>

              {/* Heart reaction badge count if any */}
              {currentStatus.hearts && currentStatus.hearts.length > 0 && (
                <>
                  <span className="opacity-40">•</span>
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <span>❤️</span>
                    <span>{currentStatus.hearts.length}</span>
                  </span>
                </>
              )}

              <Icon
                name="keyboard_arrow_up"
                size="xs"
                className="group-hover:-translate-y-0.5 transition-transform"
              />
            </div>
          </button>
        )}
      </div>

      {/* Status Viewers & Reactions Drawer (for author) */}
      <StatusViewersDrawer
        isOpen={showViewersDrawer}
        onClose={() => {
          setShowViewersDrawer(false);
          setIsPaused(false);
        }}
        status={currentStatus}
        currentUserId={currentUser.uid}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl max-w-xs w-full shadow-2xl space-y-3 text-center border border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Delete Status Update?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This status will be permanently removed for all contacts.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
