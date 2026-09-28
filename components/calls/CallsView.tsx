"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { UserProfile, Conversation } from "@/types";
import { useCall } from "@/components/providers/CallProvider";
import {
  CallLogItem,
  subscribeToCallLogs,
  deleteCallLogs,
  clearAllCallLogs,
  syncCallLogsFromConversations,
} from "@/lib/firestore/callLogService";
import { subscribeToConversations } from "@/lib/firestore/conversationService";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { NewCallModal } from "./NewCallModal";

interface CallsViewProps {
  currentUser: UserProfile;
}

/**
 * Format timestamp in WhatsApp-style call log format:
 * "Yesterday, 5:30 am", "27 September, 2:11 am", "10 August, 6:19 pm"
 */
function formatCallLogDate(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();

  // Time format: "5:30 am"
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Today, ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  // Month names: January, February, September...
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];

  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month}, ${timeStr}`;
  }

  return `${day} ${month} ${date.getFullYear()}, ${timeStr}`;
}

export const CallsView: React.FC<CallsViewProps> = ({ currentUser }) => {
  const { startCall } = useCall();
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Modals & Menu State
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isScheduleInfoOpen, setIsScheduleInfoOpen] = useState(false);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const selectionHistoryPushedRef = useRef(false);

  // Close 3-dot menu on click outside
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    if (isOptionsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOptionsMenuOpen]);

  // Subscribe to real-time call logs from Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;
    setIsLoading(true);

    // Sync any past calls from conversations if no logs exist yet
    syncCallLogsFromConversations(currentUser.uid, currentUser.displayName).catch(() => {});

    const unsub = subscribeToCallLogs(currentUser.uid, (logs) => {
      setCallLogs(logs);
      setIsLoading(false);
    });

    return () => unsub();
  }, [currentUser?.uid, currentUser?.displayName]);

  // Subscribe to conversations for top frequent contacts row
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToConversations(currentUser.uid, (list) => {
      setConversations(list);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Extract frequent/active direct chat contacts for the top horizontal row
  const frequentContacts = useMemo(() => {
    const contacts: { uid: string; displayName: string; avatarUrl?: string; conversationId?: string }[] = [];
    const seen = new Set<string>();

    conversations.forEach((conv) => {
      if (conv.type === "direct") {
        const partnerId = conv.participantIds?.find((p) => p !== currentUser.uid);
        if (partnerId && !seen.has(partnerId)) {
          seen.add(partnerId);
          const details = conv.participants?.[partnerId];
          contacts.push({
            uid: partnerId,
            displayName: details?.displayName || details?.username || "Contact",
            avatarUrl: details?.avatarUrl || "",
            conversationId: conv.id,
          });
        }
      }
    });

    return contacts.slice(0, 8);
  }, [conversations, currentUser.uid]);

  // Trap back button for Selection Mode:
  // "and when selection is on clicking back or beckword should not slose the entire calls page it should only close the call log selection feature"
  useEffect(() => {
    if (!isSelectionMode) {
      selectionHistoryPushedRef.current = false;
      return;
    }

    if (!selectionHistoryPushedRef.current) {
      window.history.pushState({ callLogSelection: true }, "");
      selectionHistoryPushedRef.current = true;
    }

    const handlePopState = () => {
      selectionHistoryPushedRef.current = false;
      setIsSelectionMode(false);
      setSelectedLogIds(new Set());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isSelectionMode]);

  // Safe exit selection mode
  const handleExitSelectionMode = () => {
    if (selectionHistoryPushedRef.current && window.history.state?.callLogSelection) {
      selectionHistoryPushedRef.current = false;
      window.history.back();
    } else {
      selectionHistoryPushedRef.current = false;
      setIsSelectionMode(false);
      setSelectedLogIds(new Set());
    }
  };

  // Toggle single log selection
  const handleToggleSelect = (logId: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // Select all or deselect all
  const handleToggleSelectAll = () => {
    if (selectedLogIds.size === filteredLogs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(filteredLogs.map((l) => l.id)));
    }
  };

  // Delete selected call logs from DB
  const handleDeleteSelected = async () => {
    if (selectedLogIds.size === 0) return;
    try {
      await deleteCallLogs(currentUser.uid, Array.from(selectedLogIds));
      handleExitSelectionMode();
    } catch (err) {
      console.error("Failed to delete selected logs:", err);
    }
  };

  // Clear all call logs for user from DB
  const handleConfirmClearAll = async () => {
    try {
      await clearAllCallLogs(currentUser.uid);
      setIsClearConfirmOpen(false);
      setIsOptionsMenuOpen(false);
      if (isSelectionMode) {
        handleExitSelectionMode();
      }
    } catch (err) {
      console.error("Failed to clear call logs:", err);
    }
  };

  // Initiate call to partner
  const handleInitiateCall = (log: CallLogItem, forceType?: "voice" | "video") => {
    if (!log.partnerId) return;
    const type = forceType || log.callType;
    startCall(
      {
        uid: log.partnerId,
        displayName: log.partnerName,
        avatarUrl: log.partnerAvatar,
        conversationId: log.conversationId,
      },
      type
    );
  };

  // Filter logs by search query if search is open
  const filteredLogs = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return callLogs;
    return callLogs.filter((log) =>
      log.partnerName.toLowerCase().includes(q)
    );
  }, [callLogs, searchFilter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0B1120] overflow-hidden select-none relative">
      
      {/* Top Header Bar */}
      {isSelectionMode ? (
        // Selection Mode Header Bar
        <header className="h-16 px-4 flex items-center justify-between bg-slate-100 dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExitSelectionMode}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-transform"
              title="Close selection"
              aria-label="Close selection"
            >
              <Icon name="close" size="md" />
            </button>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {selectedLogIds.size} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {selectedLogIds.size === filteredLogs.length ? "Deselect All" : "Select All"}
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedLogIds.size === 0}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                selectedLogIds.size > 0
                  ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-95"
                  : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
              }`}
              title="Delete selected"
              aria-label="Delete selected"
            >
              <Icon name="delete" size="md" />
            </button>
          </div>
        </header>
      ) : (
        // Standard Calls Header Bar (matching Image 1)
        <header className="h-16 px-4 sm:px-6 flex items-center justify-between bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 z-20">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Calls
          </h1>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search Icon */}
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-95 transition-transform"
              title="Search calls"
              aria-label="Search calls"
            >
              <Icon name="search" size="md" />
            </button>

            {/* 3-Dot Options Button */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-95 transition-transform"
                title="More options"
                aria-label="More options"
              >
                <Icon name="more_vert" size="md" />
              </button>

              {/* 3-Dot Dropdown Menu */}
              {isOptionsMenuOpen && (
                <div className="absolute right-0 top-12 w-48 bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      setIsClearConfirmOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors"
                  >
                    <Icon name="delete_outline" size="sm" />
                    Clear call logs
                  </button>

                  <button
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      setIsScheduleInfoOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors"
                  >
                    <Icon name="event" size="sm" />
                    Scheduled calls
                  </button>

                  <button
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      setIsSelectionMode(true);
                      setSelectedLogIds(new Set());
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors"
                  >
                    <Icon name="checklist" size="sm" />
                    Select
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Expandable Search Input */}
      {isSearchOpen && !isSelectionMode && (
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/20">
            <Icon name="search" size="sm" className="text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search call logs..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter("")}
                className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        
        {/* Top Horizontal Quick Action Row (matching Image 1) */}
        {!isSelectionMode && (
          <div className="pt-4 pb-3 px-4 sm:px-6">
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pb-1">
              
              {/* Top-Left Call Button (Opens NewCallModal) */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setIsNewCallModalOpen(true)}
                  className="w-14 h-14 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95"
                  title="Make a Call"
                  aria-label="Make a Call"
                >
                  <Icon name="call" size="md" />
                </button>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Call
                </span>
              </div>

              {/* Schedule Button (Opens Scheduled Calls dialog) */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setIsScheduleInfoOpen(true)}
                  className="w-14 h-14 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95"
                  title="Schedule a Call"
                  aria-label="Schedule a Call"
                >
                  <Icon name="calendar_today" size="md" />
                </button>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Schedule
                </span>
              </div>

              {/* Frequent Contacts from active chats (e.g. "Vuto" in Image 1) */}
              {frequentContacts.map((contact) => (
                <div
                  key={contact.uid}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                  onClick={() => {
                    startCall(
                      {
                        uid: contact.uid,
                        displayName: contact.displayName,
                        avatarUrl: contact.avatarUrl,
                        conversationId: contact.conversationId,
                      },
                      "voice"
                    );
                  }}
                >
                  <div className="relative group-hover:scale-105 group-active:scale-95 transition-transform duration-200">
                    <Avatar
                      name={contact.displayName}
                      src={contact.avatarUrl}
                      size="lg"
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[64px] truncate text-center">
                    {contact.displayName}
                  </span>
                </div>
              ))}

            </div>
          </div>
        )}

        {/* Section Title: Recent (matching Image 1) */}
        <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Recent
          </h2>
          {callLogs.length > 0 && !isSelectionMode && (
            <span className="text-xs text-slate-400 font-medium">
              {filteredLogs.length} call{filteredLogs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Recent Call Logs List (Strictly fetched from DB, zero hardcoding) */}
        <div className="divide-y divide-slate-100/80 dark:divide-slate-800/40 pb-28">
          {isLoading && callLogs.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading call history...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="px-6 py-16 text-center text-slate-400 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Icon name="phone_missed" size="lg" />
              </div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {searchFilter ? "No matching calls found" : "No call history yet"}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {searchFilter
                  ? "Try searching for a different contact name"
                  : "Tap the Call button or the green dial icon to start voice and video calls with your contacts."}
              </p>
              {!searchFilter && (
                <button
                  onClick={() => setIsNewCallModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  Start a Call
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = selectedLogIds.has(log.id);
              const isMissed = log.status === "missed" || log.status === "declined";
              const isOutgoing = log.direction === "outgoing";

              return (
                <div
                  key={log.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      handleToggleSelect(log.id);
                    }
                  }}
                  className={`flex items-center justify-between px-4 sm:px-6 py-3.5 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/70 dark:bg-blue-950/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Checkbox in selection mode */}
                    {isSelectionMode && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(log.id);
                        }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected && <Icon name="check" size="xs" />}
                      </div>
                    )}

                    {/* Contact Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar
                        name={log.partnerName}
                        src={log.partnerAvatar}
                        size="md"
                      />
                    </div>

                    {/* Contact Info & Call Status Details */}
                    <div className="min-w-0 flex-1">
                      <h3
                        className={`text-sm sm:text-base font-semibold truncate ${
                          isMissed && !isOutgoing
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {log.partnerName}
                      </h3>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        {/* Call Direction Indicator Arrow (matching Image 1) */}
                        {isOutgoing ? (
                          // Outgoing: Diagonal arrow pointing up-right (↗)
                          <span
                            className={`flex items-center ${
                              isMissed
                                ? "text-red-500"
                                : "text-emerald-500"
                            }`}
                            title="Outgoing call"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 17L17 7M17 7H9M17 7V15"
                              />
                            </svg>
                          </span>
                        ) : (
                          // Incoming: Diagonal arrow pointing down-left (↙)
                          <span
                            className={`flex items-center ${
                              isMissed
                                ? "text-red-500"
                                : "text-emerald-500"
                            }`}
                            title={isMissed ? "Missed call" : "Incoming call"}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 7L7 17M7 17H15M7 17V9"
                              />
                            </svg>
                          </span>
                        )}

                        {/* Date and time: e.g. "Yesterday, 5:30 am" */}
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {formatCallLogDate(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action: Voice or Video recall button (matching Image 1) */}
                  {!isSelectionMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInitiateCall(log);
                      }}
                      className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 active:scale-95 transition-all flex-shrink-0"
                      title={log.callType === "video" ? "Call back with video" : "Call back"}
                      aria-label={log.callType === "video" ? "Call back with video" : "Call back"}
                    >
                      {log.callType === "video" ? (
                        <Icon name="videocam" size="sm" />
                      ) : (
                        <Icon name="call" size="sm" />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Floating Action Button (Green Call Button matching Image 1) */}
      {!isSelectionMode && (
        <button
          onClick={() => setIsNewCallModalOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-30 w-14 h-14 rounded-2xl sm:rounded-full bg-[#10B981] hover:bg-[#059669] text-white shadow-xl shadow-emerald-500/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          title="New Call"
          aria-label="New Call"
        >
          <Icon name="call" size="md" />
        </button>
      )}

      {/* New Call Modal (Full screen on mobile with back button trap) */}
      <NewCallModal
        isOpen={isNewCallModalOpen}
        onClose={() => setIsNewCallModalOpen(false)}
        currentUser={currentUser}
        onStartCall={(targetUser, callType) => {
          setIsNewCallModalOpen(false);
          startCall(targetUser, callType);
        }}
      />

      {/* Clear Call Logs Confirmation Dialog */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center mb-4">
              <Icon name="delete_forever" size="md" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Clear Call Logs?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Do you want to clear your entire call history? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-md shadow-red-600/20"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Calls Info Dialog */}
      {isScheduleInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] flex items-center justify-center mb-4">
              <Icon name="event" size="md" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Scheduled Calls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Scheduled call options will be added soon! You will be able to plan audio and video calls in advance with automatic reminder notifications.
            </p>
            <div className="flex items-center justify-end mt-6">
              <button
                onClick={() => setIsScheduleInfoOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white transition-colors shadow-md shadow-blue-500/20"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
