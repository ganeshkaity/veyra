"use client";

import React, { useState, useRef, useEffect } from "react";
import { Conversation, UserProfile } from "@/types";
import { ChatListItem } from "./ChatListItem";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  isConversationPinned,
  pinConversation,
  unpinConversation,
} from "@/lib/firestore/conversationService";
import {
  isConversationLocked,
  unlockConversation,
} from "@/lib/firestore/chatLockAndListService";
import { useAuth } from "@/components/providers/AuthProvider";

interface LockedChatsViewProps {
  conversations: Conversation[];
  currentUser: UserProfile;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onBack: () => void;
  onLockedToggle?: () => void;
  onOpenManageLists?: (conv: Conversation) => void;
}

export const LockedChatsView: React.FC<LockedChatsViewProps> = ({
  conversations,
  currentUser,
  selectedConversationId,
  onSelectConversation,
  onBack,
  onLockedToggle,
  onOpenManageLists,
}) => {
  const { refreshProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Multi-selection state
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [showSelectionMoreMenu, setShowSelectionMoreMenu] = useState(false);
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false);
  const [showClearMultipleConfirm, setShowClearMultipleConfirm] = useState(false);
  const [pinRefreshTick, setPinRefreshTick] = useState(0);

  // Immediate local state for unlocked items so they vanish immediately
  const [locallyUnlockedIds, setLocallyUnlockedIds] = useState<string[]>([]);

  // Passkey Prompt Modal State
  const [unlockTargetConv, setUnlockTargetConv] = useState<Conversation | null>(null);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPasskeyText, setShowPasskeyText] = useState(false);

  // Confirmation dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Conversation | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<Conversation | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    conversation: Conversation;
    coords: {
      top?: number;
      bottom?: number;
      left?: number;
      maxHeight: number;
    };
  } | null>(null);

  const contextMenuOpenedAtRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const isSelectionMode = selectedChatIds.size > 0;

  // Filter locked conversations (excluding locally unlocked items)
  const lockedConvs = conversations.filter(
    (c) =>
      !locallyUnlockedIds.includes(c.id) &&
      isConversationLocked(c.id, currentUser)
  );

  const filteredConvs = lockedConvs.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    if (conv.type === "group") {
      return (conv.groupName || "").toLowerCase().includes(query);
    }
    if (conv.type === "ai") {
      return "veyra ai".includes(query);
    }
    const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
    const other = otherId ? conv.participants[otherId] : null;
    return (
      (other?.displayName || "").toLowerCase().includes(query) ||
      (other?.username || "").toLowerCase().includes(query)
    );
  });

  // Sort locked conversations so pinned appear at the top
  const sortedLockedConvs = [...filteredConvs].sort((a, b) => {
    const aPinned = isConversationPinned(a, currentUser.uid, false);
    const bPinned = isConversationPinned(b, currentUser.uid, false);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    const timeA = a.lastMessage?.timestamp || a.updatedAt || 0;
    const timeB = b.lastMessage?.timestamp || b.updatedAt || 0;
    return timeB - timeA;
  });

  // Push ?selection=true into URL without page refresh
  const pushSelectionUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("selection") !== "true") {
      url.searchParams.set("selection", "true");
      window.history.pushState({ selection: true }, "", url.toString());
    }
  };

  // Pop selection state from URL
  const popSelectionUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("selection") === "true") {
      window.history.back();
    }
  };

  // Listen to popstate (Android / browser Back button) to clear selection
  useEffect(() => {
    const handlePop = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("selection") !== "true") {
        setSelectedChatIds(new Set());
        setShowSelectionMoreMenu(false);
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Selection toggle
  const handleToggleSelectChat = (convId: string) => {
    const next = new Set(selectedChatIds);
    if (next.has(convId)) {
      next.delete(convId);
      if (next.size === 0) {
        popSelectionUrl();
      }
    } else {
      if (next.size === 0) {
        pushSelectionUrl();
      }
      next.add(convId);
    }
    setSelectedChatIds(next);
  };

  const handleClearSelection = () => {
    setSelectedChatIds(new Set());
    setShowSelectionMoreMenu(false);
    popSelectionUrl();
  };

  // Context Menu Open Handler
  const handleOpenContextMenu = (
    x: number,
    y: number,
    conv: Conversation
  ) => {
    if (isSelectionMode) return;
    contextMenuOpenedAtRef.current = Date.now();

    const menuWidth = 220;
    const menuEstimatedHeight = 240;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    if (left + menuWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - menuWidth - 12);
    }

    const spaceBelow = viewportHeight - y - 12;
    const spaceAbove = y - 12;

    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight = menuEstimatedHeight;

    if (spaceBelow >= menuEstimatedHeight || spaceBelow >= spaceAbove) {
      top = y;
      maxHeight = Math.min(menuEstimatedHeight, spaceBelow);
    } else {
      bottom = viewportHeight - y;
      maxHeight = Math.min(menuEstimatedHeight, spaceAbove);
    }

    setContextMenu({
      conversation: conv,
      coords: { top, bottom, left, maxHeight },
    });
  };

  // Unlock single chat with passkey
  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockTargetConv || isUnlocking) return;
    setPasskeyError(null);

    try {
      setIsUnlocking(true);
      const res = await unlockConversation(
        currentUser.uid,
        unlockTargetConv.id,
        passkeyInput.trim(),
        currentUser
      );

      if (res.success) {
        setLocallyUnlockedIds((prev) => [...prev, unlockTargetConv.id]);
        setUnlockTargetConv(null);
        setPasskeyInput("");
        await refreshProfile();
        showToast("Chat unlocked 🔓");
        onLockedToggle?.();
      } else {
        setPasskeyError(res.error || "Incorrect passkey.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error unlocking chat.";
      setPasskeyError(msg);
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] border-r border-slate-200/80 dark:border-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-semibold backdrop-blur-md shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <Icon name="check_circle" size="xs" className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      {isSelectionMode ? (
        <div className="px-4 py-3 bg-[#2563EB] text-white flex items-center justify-between shadow-md animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearSelection}
              aria-label="Cancel selection"
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <Icon name="close" size="sm" />
            </button>
            <span className="font-bold text-sm">
              {selectedChatIds.size} selected
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setShowSelectionMoreMenu(!showSelectionMoreMenu);
              }}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              title="More actions"
            >
              <Icon name="more_vert" size="sm" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Back to chats"
              className="p-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Icon name="arrow_back" size="sm" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Icon name="lock" size="xs" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Locked Chats
              </h3>
            </div>
          </div>

          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60">
            {lockedConvs.length}
          </span>
        </div>
      )}

      {/* Search Input */}
      {!isSelectionMode && (
        <div className="px-3.5 pt-3 pb-2 border-b border-slate-100/60 dark:border-slate-800/40">
          <div className="relative flex items-center">
            <Icon
              name="search"
              size="sm"
              className="absolute left-3 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locked chats"
              className="w-full bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm rounded-full pl-9 pr-8 py-2 border-none outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Body List */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-4 overscroll-contain">
        {sortedLockedConvs.length > 0 ? (
          <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
            {sortedLockedConvs.map((conv) => {
              const isSelected = selectedConversationId === conv.id;
              const isChecked = selectedChatIds.has(conv.id);

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      handleToggleSelectChat(conv.id);
                    } else {
                      onSelectConversation(conv.id);
                    }
                  }}
                  className="cursor-pointer select-none"
                >
                  <ChatListItem
                    conversation={conv}
                    currentUser={currentUser}
                    isSelected={isSelected}
                    isSelectionMode={isSelectionMode}
                    isSelectedForAction={isChecked}
                    onToggleSelect={() => handleToggleSelectChat(conv.id)}
                    onSelect={() => {
                      if (isSelectionMode) {
                        handleToggleSelectChat(conv.id);
                      } else {
                        onSelectConversation(conv.id);
                      }
                    }}
                    onContextMenu={handleOpenContextMenu}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <Icon name="lock" size="md" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {searchQuery ? "No matching locked chats" : "No Locked Chats"}
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">
              {searchQuery
                ? "Try searching for a different name."
                : "Right-click or long-press any chat in your chats list and select 'Lock chat' to hide it here."}
            </p>
          </div>
        )}
      </div>

      {/* PASSKEY VERIFICATION MODAL TO UNLOCK CHAT */}
      {unlockTargetConv && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Icon name="lock_open" size="xs" className="text-emerald-600" />
                <span>Unlock Chat</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setUnlockTargetConv(null);
                  setPasskeyInput("");
                  setPasskeyError(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your secret passkey to unlock this chat and restore it to your regular chats list.
            </p>

            {passkeyError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                <Icon name="error" size="xs" />
                <span>{passkeyError}</span>
              </div>
            )}

            <form onSubmit={handleUnlockSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showPasskeyText ? "text" : "password"}
                  autoFocus
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="Enter passkey"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskeyText((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <Icon name={showPasskeyText ? "visibility_off" : "visibility"} size="xs" />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockTargetConv(null);
                    setPasskeyInput("");
                    setPasskeyError(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passkeyInput.trim() || isUnlocking}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all disabled:opacity-50"
                >
                  {isUnlocking ? "Unlocking..." : "Unlock Chat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTEXT MENU FOR LOCKED CHATS */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/20"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            style={{
              position: "absolute",
              top: contextMenu.coords.top !== undefined ? `${contextMenu.coords.top}px` : undefined,
              bottom: contextMenu.coords.bottom !== undefined ? `${contextMenu.coords.bottom}px` : undefined,
              left: `${contextMenu.coords.left}px`,
              maxHeight: `${contextMenu.coords.maxHeight}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-56 bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="py-1">
              {/* Unlock Chat */}
              <button
                type="button"
                onClick={() => {
                  const conv = contextMenu.conversation;
                  setContextMenu(null);
                  setUnlockTargetConv(conv);
                  setPasskeyInput("");
                  setPasskeyError(null);
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Icon name="lock_open" size="xs" className="text-emerald-600" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Unlock chat
                </span>
              </button>

              {/* Select Chat */}
              <button
                type="button"
                onClick={() => {
                  const id = contextMenu.conversation.id;
                  setContextMenu(null);
                  pushSelectionUrl();
                  setSelectedChatIds(new Set([id]));
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Icon name="check_circle" size="xs" className="text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300">Select chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
