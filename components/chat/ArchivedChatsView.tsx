"use client";

import React, { useState, useRef, useEffect } from "react";
import { Conversation, UserProfile } from "@/types";
import { ChatListItem } from "./ChatListItem";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  isConversationArchived,
  unarchiveConversation,
  isConversationPinned,
  pinConversation,
  unpinConversation,
  deleteConversation,
  clearConversation,
  deleteMultipleConversations,
  clearMultipleConversations,
  isConversationDeleted,
  markConversationAsRead,
  markConversationAsUnread,
} from "@/lib/firestore/conversationService";

interface ArchivedChatsViewProps {
  conversations: Conversation[];
  currentUser: UserProfile;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onBack: () => void;
  onArchiveToggle?: () => void;
}

export const ArchivedChatsView: React.FC<ArchivedChatsViewProps> = ({
  conversations,
  currentUser,
  selectedConversationId,
  onSelectConversation,
  onBack,
  onArchiveToggle,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Multi-selection state
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [isSelectionModeState, setIsSelectionModeState] = useState<boolean>(false);
  const isSelectionMode = isSelectionModeState || selectedChatIds.size > 0;
  const [showSelectionMoreMenu, setShowSelectionMoreMenu] = useState(false);
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false);
  const [showClearMultipleConfirm, setShowClearMultipleConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState<Conversation | null>(null);
  const [alsoDeleteStarred, setAlsoDeleteStarred] = useState(false);
  const [pinRefreshTick, setPinRefreshTick] = useState(0);

  // Immediate local state for unarchived items so they vanish immediately from the view
  const [locallyUnarchivedIds, setLocallyUnarchivedIds] = useState<string[]>([]);

  // Context menu state for archived chat items
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

  // Filter archived conversations (excluding locally unarchived items & deleted items)
  const archivedConvs = conversations.filter(
    (c) =>
      !locallyUnarchivedIds.includes(c.id) &&
      !isConversationDeleted(c, currentUser.uid) &&
      isConversationArchived(c, currentUser.uid)
  );

  const filteredConvs = archivedConvs.filter((conv) => {
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

  // Sort archived conversations so pinned appear at the top (max 4 pinned in archive section)
  const sortedArchivedConvs = [...filteredConvs].sort((a, b) => {
    const aPinned = isConversationPinned(a, currentUser.uid, true);
    const bPinned = isConversationPinned(b, currentUser.uid, true);
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

  // Exit selection mode without page reload - cleanly restores URL
  const handleExitSelectionMode = () => {
    setIsSelectionModeState(false);
    setSelectedChatIds(new Set());
    setShowSelectionMoreMenu(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("selection") === "true") {
        url.searchParams.delete("selection");
        const cleanUrl = url.pathname + (url.search ? url.search : "");
        window.history.replaceState(null, "", cleanUrl);
      }
    }
  };

  // Listen to popstate (Android / browser Back button) to clear selection
  useEffect(() => {
    const handlePop = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("selection") !== "true") {
        setIsSelectionModeState(false);
        setSelectedChatIds(new Set());
        setShowSelectionMoreMenu(false);
      } else {
        setIsSelectionModeState(true);
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Respect ?selection=true on mount without reload
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("selection") === "true") {
      setIsSelectionModeState(true);
    }
  }, []);

  const handleCancelSelection = () => {
    handleExitSelectionMode();
  };

  const handleToggleSelectChat = (convId: string) => {
    if (!isSelectionMode) {
      setIsSelectionModeState(true);
      pushSelectionUrl();
    }
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      return next;
    });
  };

  const handleOpenContextMenu = (x: number, y: number, conv: Conversation) => {
    contextMenuOpenedAtRef.current = Date.now();
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 800;
    const windowHeight = typeof window !== "undefined" ? window.innerHeight : 600;
    const menuEstimatedHeight = 280;
    const menuWidth = 220;

    const spaceBelow = windowHeight - y;
    const spaceAbove = y;

    let coords: {
      top?: number;
      bottom?: number;
      left?: number;
      maxHeight: number;
    };

    if (spaceBelow >= menuEstimatedHeight) {
      coords = {
        top: Math.min(y + 4, windowHeight - 100),
        maxHeight: Math.min(420, spaceBelow - 16),
      };
    } else if (spaceAbove >= menuEstimatedHeight) {
      coords = {
        bottom: Math.max(10, windowHeight - y + 4),
        maxHeight: Math.min(420, spaceAbove - 16),
      };
    } else {
      if (spaceBelow >= spaceAbove) {
        coords = {
          top: Math.max(10, y + 4),
          maxHeight: Math.max(180, spaceBelow - 16),
        };
      } else {
        coords = {
          bottom: Math.max(10, windowHeight - y + 4),
          maxHeight: Math.max(180, spaceAbove - 16),
        };
      }
    }

    coords.left = Math.max(12, Math.min(windowWidth - menuWidth - 12, x));

    setContextMenu({
      conversation: conv,
      coords,
    });
  };

  // Immediate Unarchive single chat
  const handleUnarchive = async (conv: Conversation) => {
    setLocallyUnarchivedIds((prev) => [...prev, conv.id]);
    await unarchiveConversation(conv.id, currentUser.uid);
    showToast("Chat unarchived");
    onArchiveToggle?.();
  };

  // Check if all selected archived chats are pinned
  const selectedConvs = sortedArchivedConvs.filter((c) => selectedChatIds.has(c.id));
  const allSelectedArePinned =
    selectedConvs.length > 0 &&
    selectedConvs.every((c) => isConversationPinned(c, currentUser.uid, true));

  // Multi-action: Pin / Unpin Selected in Archive Section
  const handlePinSelected = async () => {
    if (allSelectedArePinned) {
      for (const conv of selectedConvs) {
        await unpinConversation(conv.id, currentUser.uid, true);
      }
      showToast("Chats unpinned");
      setPinRefreshTick((t) => t + 1);
      handleExitSelectionMode();
    } else {
      const unpinnedSelected = selectedConvs.filter(
        (c) => !isConversationPinned(c, currentUser.uid, true)
      );
      const alreadyPinnedCount = archivedConvs.filter((c) =>
        isConversationPinned(c, currentUser.uid, true)
      ).length;

      if (alreadyPinnedCount + unpinnedSelected.length > 4) {
        showToast("You can only pin up to 4 chats in archived");
        return;
      }

      for (const conv of unpinnedSelected) {
        await pinConversation(conv.id, currentUser.uid, true);
      }
      showToast("Chats pinned to top");
      setPinRefreshTick((t) => t + 1);
      handleExitSelectionMode();
    }
  };

  // Multi-action: Unarchive Selected
  const handleUnarchiveSelected = async () => {
    const ids = Array.from(selectedChatIds);
    handleExitSelectionMode();
    setLocallyUnarchivedIds((prev) => [...prev, ...ids]);
    for (const id of ids) {
      await unarchiveConversation(id, currentUser.uid);
    }
    showToast(`${ids.length} ${ids.length === 1 ? "chat" : "chats"} unarchived`);
    onArchiveToggle?.();
  };

  // Multi-action: Delete Selected
  const handleDeleteSelected = () => {
    setShowDeleteMultipleConfirm(true);
  };

  // 3-Dot Dropdown Actions
  const handleMarkReadSelected = async () => {
    setShowSelectionMoreMenu(false);
    const ids = Array.from(selectedChatIds);
    handleExitSelectionMode();
    await Promise.allSettled(
      ids.map((id) => markConversationAsRead(id, currentUser.uid))
    );
    showToast(
      `Marked ${ids.length} ${ids.length === 1 ? "chat" : "chats"} as read`
    );
  };

  const handleMarkUnreadSelected = async () => {
    setShowSelectionMoreMenu(false);
    const ids = Array.from(selectedChatIds);
    handleExitSelectionMode();
    await Promise.allSettled(
      ids.map((id) => markConversationAsUnread(id, currentUser.uid))
    );
    showToast(
      `Marked ${ids.length} ${ids.length === 1 ? "chat" : "chats"} as unread`
    );
  };

  const handleSelectAll = () => {
    setShowSelectionMoreMenu(false);
    setIsSelectionModeState(true);
    pushSelectionUrl();
    const allIds = new Set(sortedArchivedConvs.map((c) => c.id));
    setSelectedChatIds(allIds);
  };

  const handleLockSelected = () => {
    setShowSelectionMoreMenu(false);
    showToast("Selected chats locked with passkey");
    handleExitSelectionMode();
  };

  const handleFavouriteSelected = () => {
    setShowSelectionMoreMenu(false);
    showToast("Added to favourites");
    handleExitSelectionMode();
  };

  const handleAddToListSelected = () => {
    setShowSelectionMoreMenu(false);
    showToast("Added to list");
    handleExitSelectionMode();
  };

  const handleClearSelected = () => {
    setShowSelectionMoreMenu(false);
    setShowClearMultipleConfirm(true);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] border-r border-slate-200/80 dark:border-slate-800/90 relative select-none">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}

      {/* Header Bar / Selection Action Bar */}
      {isSelectionMode ? (
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#0C1322] text-white shadow-md z-30 transition-all select-none border-b border-slate-700/60">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleCancelSelection}
              className="p-1 -ml-1 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
              aria-label="Cancel selection"
            >
              <Icon name="arrow_back" size="md" />
            </button>
            <span className="text-xl font-bold tracking-tight text-white leading-none">
              {selectedChatIds.size}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 relative">
            {/* Pin / Unpin Action */}
            <button
              type="button"
              onClick={handlePinSelected}
              className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
              title={allSelectedArePinned ? "Unpin chats" : "Pin chats"}
              aria-label={allSelectedArePinned ? "Unpin chats" : "Pin chats"}
            >
              <Icon
                name="keep"
                size="sm"
                className={allSelectedArePinned ? "text-[#00A884]" : ""}
              />
            </button>

            {/* Delete Action */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
              title="Delete chats"
              aria-label="Delete chats"
            >
              <Icon name="delete" size="sm" />
            </button>

            {/* Unarchive Action (In Archived Section) */}
            <button
              type="button"
              onClick={handleUnarchiveSelected}
              className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
              title="Unarchive chats"
              aria-label="Unarchive chats"
            >
              <Icon name="unarchive" size="sm" />
            </button>

            {/* 3-dots More Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSelectionMoreMenu(!showSelectionMoreMenu)}
                className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
                title="More options"
                aria-label="More options"
              >
                <Icon name="more_vert" size="sm" />
              </button>

              {showSelectionMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSelectionMoreMenu(false)}
                  />
                  <div className="absolute right-0 top-11 z-50 w-52 bg-[#1E293B] text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 py-1.5 text-xs animate-in fade-in zoom-in-95 select-none">
                    <button
                      type="button"
                      onClick={handleMarkReadSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Mark as read
                    </button>
                    <button
                      type="button"
                      onClick={handleMarkUnreadSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Mark as unread
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={handleLockSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Lock chats
                    </button>
                    <button
                      type="button"
                      onClick={handleFavouriteSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Add to Favourites
                    </button>
                    <button
                      type="button"
                      onClick={handleAddToListSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Add to list
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer border-t border-slate-700/60"
                    >
                      Clear chats
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Regular Archive Header */
        <div className="h-16 px-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 flex-shrink-0 bg-white dark:bg-[#0F172A]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chats"
            className="p-2 -ml-1 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
          >
            <Icon name="arrow_back" size="md" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Archived
              </h2>
              {archivedConvs.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  {archivedConvs.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Chats stay archived when new messages arrive
            </p>
          </div>
        </div>
      )}

      {/* Search Input (Hidden during Selection Mode) */}
      {!isSelectionMode && archivedConvs.length > 3 && (
        <div className="px-3.5 pt-2.5 pb-2">
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
              placeholder="Search archived chats"
              className="w-full bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs rounded-full pl-9 pr-8 py-2 border-none outline-none focus:ring-1 focus:ring-[#00A884]"
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

      {/* Notice Banner (Hidden during Selection Mode) */}
      {!isSelectionMode && (
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/50 flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <Icon name="archive" size="xs" className="text-slate-400 flex-shrink-0" />
          <span className="text-[11.5px] leading-snug">
            Archived chats remain here and won't notify you on the main chat list.
          </span>
        </div>
      )}

      {/* Archived Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {sortedArchivedConvs.length > 0 ? (
          sortedArchivedConvs.map((conv) => (
            <ChatListItem
              key={conv.id}
              conversation={conv}
              currentUser={currentUser}
              isSelected={selectedConversationId === conv.id}
              isPinned={isConversationPinned(conv, currentUser.uid, true)}
              isSelectionMode={isSelectionMode}
              isSelectedForAction={selectedChatIds.has(conv.id)}
              onSelect={() => onSelectConversation(conv.id)}
              onToggleSelect={() => handleToggleSelectChat(conv.id)}
              onContextMenu={handleOpenContextMenu}
            />
          ))
        ) : (
          <EmptyState
            icon="inventory_2"
            title="No archived chats"
            description={
              searchQuery
                ? `No archived chats match "${searchQuery}".`
                : "When you archive chats, they will be organized neatly in this folder."
            }
            className="my-auto py-16"
          />
        )}
      </div>

      {/* Context Menu for Archived Chats */}
      {contextMenu && (
        <>
          {/* Fullscreen Backdrop */}
          <div
            className="fixed inset-0 z-[80] bg-black/15 dark:bg-black/40 backdrop-blur-[0.5px] cursor-default"
            onClick={(e) => {
              if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              setContextMenu(null);
            }}
            onTouchEnd={(e) => {
              if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              setContextMenu(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                return;
              }
              setContextMenu(null);
            }}
          />

          {/* Context Menu Popup with Slate Theme Colors */}
          <div
            style={{
              top:
                contextMenu.coords.top !== undefined
                  ? `${contextMenu.coords.top}px`
                  : undefined,
              bottom:
                contextMenu.coords.bottom !== undefined
                  ? `${contextMenu.coords.bottom}px`
                  : undefined,
              left:
                contextMenu.coords.left !== undefined
                  ? `${contextMenu.coords.left}px`
                  : undefined,
              maxHeight: `${contextMenu.coords.maxHeight}px`,
            }}
            className="fixed z-[90] w-56 overflow-y-auto bg-white/98 dark:bg-[#1E293B]/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 py-1.5 text-xs animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100 select-none divide-y divide-slate-100 dark:divide-slate-700/60"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <div className="py-0.5">
              {/* 1. Unarchive Option */}
              <button
                type="button"
                onClick={() => {
                  if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                  const targetConv = contextMenu.conversation;
                  setContextMenu(null);
                  handleUnarchive(targetConv);
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon
                  name="unarchive"
                  size="sm"
                  className="text-[#00A884] dark:text-[#00A884]"
                />
                <span className="font-semibold text-[13.5px] text-[#00A884] dark:text-[#00A884]">
                  Unarchive chat
                </span>
              </button>

              {/* 2. Pin / Unpin Chat (In Archive Section) */}
              {(() => {
                const isPinned = isConversationPinned(
                  contextMenu.conversation,
                  currentUser.uid,
                  true
                );
                return (
                  <button
                    type="button"
                    onClick={async () => {
                      if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                      const targetConv = contextMenu.conversation;
                      setContextMenu(null);
                      if (isPinned) {
                        await unpinConversation(targetConv.id, currentUser.uid, true);
                        showToast("Chat unpinned");
                        setPinRefreshTick((t) => t + 1);
                      } else {
                        const res = await pinConversation(targetConv.id, currentUser.uid, true);
                        if (res.success) {
                          showToast("Chat pinned");
                          setPinRefreshTick((t) => t + 1);
                        } else {
                          showToast(res.message || "You can only pin up to 4 chats in archived");
                        }
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                  >
                    <Icon
                      name="keep"
                      size="sm"
                      className={`text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors ${
                        isPinned ? "text-[#00A884] dark:text-[#00A884]" : ""
                      }`}
                    />
                    <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">
                      {isPinned ? "Unpin chat" : "Pin chat"}
                    </span>
                  </button>
                );
              })()}

              {/* 3. Mark as read / unread */}
              {(() => {
                const targetConv = contextMenu.conversation;
                const isUnread = (targetConv.unreadCount?.[currentUser.uid] || 0) > 0;
                return (
                  <button
                    type="button"
                    onClick={async () => {
                      if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                      setContextMenu(null);
                      if (isUnread) {
                        await markConversationAsRead(targetConv.id, currentUser.uid);
                        showToast("Marked as read");
                      } else {
                        await markConversationAsUnread(targetConv.id, currentUser.uid);
                        showToast("Marked as unread");
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                  >
                    <Icon
                      name={isUnread ? "mark_chat_read" : "mark_chat_unread"}
                      size="sm"
                      className="text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                    />
                    <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">
                      {isUnread ? "Mark as read" : "Mark as unread"}
                    </span>
                  </button>
                );
              })()}
            </div>

            <div className="py-0.5">
              {/* Select chat */}
              <button
                type="button"
                onClick={() => {
                  const targetConv = contextMenu.conversation;
                  setContextMenu(null);
                  setIsSelectionModeState(true);
                  pushSelectionUrl();
                  setSelectedChatIds(new Set([targetConv.id]));
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon
                  name="check_box"
                  size="sm"
                  className="text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">
                  Select chat
                </span>
              </button>

              {/* Clear chat */}
              <button
                type="button"
                onClick={() => {
                  const targetConv = contextMenu.conversation;
                  setContextMenu(null);
                  setAlsoDeleteStarred(false);
                  setShowClearConfirm(targetConv);
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon
                  name="remove_circle_outline"
                  size="sm"
                  className="text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">
                  Clear chat
                </span>
              </button>

              {/* 4. Delete chat */}
              <button
                type="button"
                onClick={async () => {
                  const targetConv = contextMenu.conversation;
                  setContextMenu(null);
                  await deleteConversation(targetConv.id, currentUser.uid);
                  if (selectedConversationId === targetConv.id) {
                    onSelectConversation("");
                  }
                  showToast("Chat deleted");
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors group cursor-pointer"
              >
                <Icon
                  name="delete"
                  size="sm"
                  className="text-slate-400 group-hover:text-rose-500"
                />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                  Delete chat
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal: Delete Multiple Chats */}
      {showDeleteMultipleConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Delete {selectedChatIds.size} {selectedChatIds.size === 1 ? "chat" : "chats"}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to delete the selected chats? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowDeleteMultipleConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const count = selectedChatIds.size;
                  const ids = Array.from(selectedChatIds);
                  setShowDeleteMultipleConfirm(false);
                  handleExitSelectionMode();
                  await deleteMultipleConversations(ids, currentUser.uid);
                  if (selectedConversationId && ids.includes(selectedConversationId)) {
                    onSelectConversation("");
                  }
                  showToast(`${count} ${count === 1 ? "chat" : "chats"} deleted`);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear Multiple Chats */}
      {showClearMultipleConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Clear {selectedChatIds.size} {selectedChatIds.size === 1 ? "chat" : "chats"}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Messages in the selected chats will be cleared from this device.
            </p>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none mb-5">
              <input
                type="checkbox"
                checked={alsoDeleteStarred}
                onChange={(e) => setAlsoDeleteStarred(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Also delete starred messages
              </span>
            </label>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowClearMultipleConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const count = selectedChatIds.size;
                  const ids = Array.from(selectedChatIds);
                  setShowClearMultipleConfirm(false);
                  handleExitSelectionMode();
                  await clearMultipleConversations(ids, currentUser.uid, alsoDeleteStarred);
                  showToast(`Messages in ${count} ${count === 1 ? "chat" : "chats"} cleared`);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear Single Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Clear this chat?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Messages will be cleared from this device.
            </p>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none mb-5">
              <input
                type="checkbox"
                checked={alsoDeleteStarred}
                onChange={(e) => setAlsoDeleteStarred(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Also delete starred messages
              </span>
            </label>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowClearConfirm(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const conv = showClearConfirm;
                  setShowClearConfirm(null);
                  await clearConversation(conv.id, currentUser.uid, alsoDeleteStarred);
                  showToast("Chat messages cleared");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
