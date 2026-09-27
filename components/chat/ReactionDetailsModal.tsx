"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { UserProfile } from "@/types";

export interface ReactionItem {
  emoji: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: number;
}

interface ReactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactions: Record<string, ReactionItem> | undefined;
  currentUser: UserProfile;
  onRemoveReaction?: (emoji: string) => void;
}

export const ReactionDetailsModal: React.FC<ReactionDetailsModalProps> = ({
  isOpen,
  onClose,
  reactions,
  currentUser,
  onRemoveReaction,
}) => {
  const [activeTab, setActiveTab] = useState<string>("all");
  const pushedHistoryRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Requirement: Back button / backward key handling intercepts popstate
  // to close only the modal and not reload or close the chat
  useEffect(() => {
    if (!isOpen) {
      pushedHistoryRef.current = false;
      return;
    }

    if (typeof window !== "undefined" && !pushedHistoryRef.current) {
      const stateObj = { ...(window.history.state || {}), modal: "reactionDetails" };
      window.history.pushState(stateObj, "", window.location.href);
      pushedHistoryRef.current = true;
    }

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      pushedHistoryRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => {
      window.removeEventListener("popstate", handlePopState, true);
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    onCloseRef.current();
    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  };

  if (!isOpen || !reactions) return null;

  const reactionList = Object.values(reactions);
  if (reactionList.length === 0) return null;

  // Group by emojis for tabs
  const emojiCounts: Record<string, number> = {};
  reactionList.forEach((r) => {
    emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1;
  });
  const distinctEmojis = Object.keys(emojiCounts);

  const filteredList =
    activeTab === "all"
      ? reactionList
      : reactionList.filter((r) => r.emoji === activeTab);

  const formatReactionTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    if (isToday) return `Today at ${timeStr}`;
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Modal Container: Bottom sheet on mobile, centered modal on desktop */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-sm max-h-[82vh] sm:max-h-[70vh] bg-white dark:bg-[#1E293B] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
      >
        {/* Mobile Pull Indicator */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="p-1 -ml-1 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Back"
              aria-label="Back"
            >
              <Icon name="arrow_back" size="xs" />
            </button>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Reactions
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {reactionList.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <Icon name="close" size="xs" />
          </button>
        </div>

        {/* Emoji Filter Tabs */}
        {distinctEmojis.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800/60 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#2563EB] text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              All {reactionList.length}
            </button>
            {distinctEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setActiveTab(emoji)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === emoji
                    ? "bg-[#2563EB] text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>{emoji}</span>
                <span>{emojiCounts[emoji]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reactor List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {filteredList.map((item) => {
            const isMe = item.userId === currentUser.uid;
            return (
              <div
                key={`${item.userId}-${item.emoji}`}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* User Avatar with Emoji badge */}
                  <div className="relative flex-shrink-0">
                    {item.userAvatar ? (
                      <img
                        src={item.userAvatar}
                        alt={item.userName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-200 text-sm">
                        {item.userName ? item.userName.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 text-sm drop-shadow-xs">
                      {item.emoji}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {isMe ? "You" : item.userName || "User"}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      {formatReactionTime(item.timestamp)}
                    </p>
                  </div>
                </div>

                {isMe && onRemoveReaction && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveReaction(item.emoji);
                      handleClose();
                    }}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
