"use client";

import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { StatusItem, StatusViewerInfo } from "@/types";

interface StatusViewersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  status: StatusItem;
  currentUserId: string;
}

function formatRelativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const StatusViewersDrawer: React.FC<StatusViewersDrawerProps> = ({
  isOpen,
  onClose,
  status,
  currentUserId,
}) => {
  if (!isOpen) return null;

  // Filter out the author themselves from the viewers list
  const otherViewers: StatusViewerInfo[] = (status.viewers || []).filter(
    (v) => v.userId !== currentUserId
  );

  const heartCount = (status.hearts || []).length;
  const viewCount = otherViewers.length;

  return (
    <>
      {/* Dark overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 rounded-t-3xl border-t border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col max-h-[70vh] h-[460px] animate-in slide-in-from-bottom duration-250 overflow-hidden"
        style={{
          boxShadow: "0 -20px 40px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Top Drag Handle */}
        <div className="pt-2.5 pb-1 flex justify-center items-center flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Viewed by {viewCount}</span>
              {heartCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold border border-rose-500/20">
                  <span>❤️</span>
                  <span>{heartCount}</span>
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Contacts who saw this status update
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
            aria-label="Close viewers list"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Viewers & Heart Reacts List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
          {otherViewers.length > 0 ? (
            otherViewers.map((viewer) => {
              const hasHeart =
                viewer.hasHearted ||
                (status.hearts || []).some((h) => h.userId === viewer.userId);

              return (
                <div
                  key={viewer.userId}
                  className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={viewer.userDisplayName}
                      src={viewer.userAvatarUrl}
                      size="md"
                      className="flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {viewer.userDisplayName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(viewer.viewedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Reaction badge */}
                  {hasHeart && (
                    <div
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200/80 dark:border-rose-900/60 animate-in zoom-in-75 duration-150 shadow-xs flex-shrink-0"
                      title="Reacted with a heart ❤️"
                    >
                      <span className="text-sm">❤️</span>
                      <span className="text-[11px] font-semibold">Liked</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                <Icon name="visibility" size="md" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No views yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                When other contacts view your status, their profile and reactions will appear here in realtime.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
