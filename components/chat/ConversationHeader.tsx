"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Conversation, ChatMessage, UserProfile, UserPresence, TypingIndicator } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatLastSeen } from "@/lib/realtime/presenceService";
import { deleteConversation, clearConversation } from "@/lib/firestore/conversationService";
import {
  isConversationFavourite,
  toggleConversationFavourite,
  isConversationLocked,
  lockConversation,
  unlockConversation,
  getEffectiveChatLists,
  toggleConversationList,
} from "@/lib/firestore/chatLockAndListService";

interface ConversationHeaderProps {
  conversation: Conversation;
  currentUser: UserProfile;
  presence: UserPresence | null;
  typingList: TypingIndicator[];
  messages?: ChatMessage[];
  isAiResponding?: boolean;
  onToggleDetails: () => void;
  onBackMobile: () => void;
  isSearchOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onOpenSearch?: () => void;
  onCloseSearch?: () => void;
  matchCount?: number;
  currentMatchIndex?: number;
  onPrevMatch?: () => void;
  onNextMatch?: () => void;
  onOpenSelectionMode?: () => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  currentUser,
  presence,
  typingList,
  messages = [],
  isAiResponding,
  onToggleDetails,
  onBackMobile,
  isSearchOpen = false,
  searchQuery = "",
  onSearchChange,
  onOpenSearch,
  onCloseSearch,
  matchCount = 0,
  currentMatchIndex = 0,
  onPrevMatch,
  onNextMatch,
  onOpenSelectionMode,
}) => {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [alsoDeleteStarred, setAlsoDeleteStarred] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);

  React.useEffect(() => {
    setIsFavourite(isConversationFavourite(conversation.id, currentUser));
    setIsLocked(isConversationLocked(conversation.id, currentUser));
  }, [conversation.id, currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Participant details
  let name = "";
  let avatarUrl = "";
  let username = "";
  let isAi = conversation.type === "ai";
  let isGroup = conversation.type === "group";

  if (isGroup) {
    name = conversation.groupName || "Group";
    avatarUrl = conversation.groupAvatar || "";
  } else if (isAi) {
    name = "Veyra AI";
    avatarUrl = "/assets/veyra_ai_logo.png";
  } else {
    const otherId = conversation.participantIds.find((id) => id !== currentUser.uid);
    const other = otherId ? conversation.participants[otherId] : null;
    name = other?.displayName || "User";
    avatarUrl = other?.avatarUrl || "";
    username = other?.username ? `@${other.username}` : "";
  }

  // Subtitle / Status
  let statusText = "";
  if (isAi) {
    statusText = isAiResponding
      ? "thinking..."
      : "AI Agent - Powered by GPT-OSS";
  } else if (typingList.length > 0) {
    statusText =
      typingList.length === 1
        ? `${typingList[0].displayName || "Someone"} is typing...`
        : typingList.length === 2
          ? `${typingList[0].displayName} and ${typingList[1].displayName} are typing...`
          : `${typingList[0].displayName} and ${typingList.length - 1} others are typing...`;
  } else if (isGroup) {
    statusText = `${conversation.participantIds.length} members`;
  } else {
    statusText = formatLastSeen(presence);
  }

  // Action handlers
  const handleExportChat = () => {
    setShowMenu(false);
    try {
      let exportBody = `========================================\n`;
      exportBody += `Veyra Chat Export: ${name}\n`;
      exportBody += `Exported on: ${new Date().toLocaleString()}\n`;
      exportBody += `========================================\n\n`;

      if (messages && messages.length > 0) {
        messages.forEach((msg) => {
          const sender = msg.senderId === currentUser.uid ? "You" : name;
          const time = new Date(msg.createdAt).toLocaleString();
          const text = msg.text || (msg.mediaUrl ? `[Media: ${msg.type || "attachment"}]` : "[Message]");
          exportBody += `[${time}] ${sender}: ${text}\n`;
        });
      } else {
        exportBody += `(No message history recorded in current session)\n`;
      }

      const blob = new Blob([exportBody], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Veyra-Chat-${name.replace(/[^\w\s-]/gi, "").trim() || "export"}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Chat exported successfully 📄");
    } catch {
      showToast("Failed to export chat");
    }
  };

  const handleSendCallLink = () => {
    setShowMenu(false);
    try {
      const callUrl = `${window.location.origin}/call/${conversation.id}`;
      navigator.clipboard.writeText(callUrl);
      showToast("Call link copied to clipboard! 🔗");
    } catch {
      showToast("Could not copy call link");
    }
  };

  if (isSearchOpen) {
    return (
      <div className="relative flex items-center justify-between px-3 md:px-4 py-2 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 select-none z-30 animate-in fade-in slide-in-from-top-1 duration-150">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onCloseSearch}
            title="Close search"
            aria-label="Close search"
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="arrow_back" size="sm" />
          </button>
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              autoFocus
              placeholder="Search in conversation..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey) onPrevMatch?.();
                  else onNextMatch?.();
                } else if (e.key === "Escape") {
                  onCloseSearch?.();
                }
              }}
              className="w-full bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1.5 focus:ring-teal-500 dark:focus:ring-teal-400 border border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange?.("")}
                title="Clear input"
                className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-2 text-slate-600 dark:text-slate-300">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1 whitespace-nowrap min-w-[50px] text-center">
            {searchQuery.trim()
              ? matchCount > 0
                ? `${currentMatchIndex + 1} of ${matchCount}`
                : "No matches"
              : ""}
          </span>
          <button
            onClick={onPrevMatch}
            disabled={matchCount === 0}
            title="Previous match (Shift+Enter)"
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Icon name="keyboard_arrow_up" size="sm" />
          </button>
          <button
            onClick={onNextMatch}
            disabled={matchCount === 0}
            title="Next match (Enter)"
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Icon name="keyboard_arrow_down" size="sm" />
          </button>
          <button
            onClick={onCloseSearch}
            title="Close"
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-between px-3 md:px-4 py-1 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 select-none transition-all ${showMenu ? "z-[60]" : "z-30"
      }`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}

      {/* Left: Mobile back arrow + Avatar + Contact Name / Status */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <button
          onClick={onBackMobile}
          aria-label="Back to conversations"
          className="md:hidden p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="arrow_back" size="sm" />
        </button>

        <button
          onClick={onToggleDetails}
          title="View conversation details"
          className="flex items-center gap-2.5 text-left group min-w-0 focus:outline-none p-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          <Avatar
            name={name}
            src={avatarUrl}
            size="sm"
            isOnline={isAi ? true : isGroup ? undefined : presence?.isOnline}
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-[#2563EB] dark:group-hover:text-[#14B8A6] transition-colors leading-tight">
              {name}
            </h3>
            <p
              className={`text-[11px] truncate leading-tight ${isAi && isAiResponding
                  ? "text-teal-600 dark:text-teal-400 font-semibold animate-pulse"
                  : typingList.length > 0
                    ? "text-emerald-500 font-medium animate-pulse"
                    : presence?.isOnline || isAi
                      ? "text-emerald-500 font-medium"
                      : "text-slate-400"
                }`}
            >
              {statusText}
            </p>
          </div>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="relative flex items-center gap-1">
        {!isAi && (
          <button
            onClick={() => showToast("Voice calling is coming soon!")}
            title="Voice Call"
            aria-label="Voice Call"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="call" size="md" />
          </button>
        )}

        <button
          onClick={onOpenSearch}
          title="Search in chat"
          aria-label="Search in chat"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="search" size="md" />
        </button>

        {/* 3-dot Menu Button replacing Info button */}
        <button
          onClick={() => setShowMenu((prev) => !prev)}
          title="More options"
          aria-label="More options"
          className={`p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${showMenu ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : ""
            }`}
        >
          <Icon name="more_vert" size="md" />
        </button>

        {/* Chat Options Dropdown Menu */}
        {showMenu && (
          <>
            {/* Click-outside backdrop */}
            <div
              className="fixed inset-0 z-[60] bg-black/10 dark:bg-black/25 cursor-default"
              onClick={() => setShowMenu(false)}
            />

            {/* Menu Popup */}
            <div className="absolute right-0 top-12 z-[70] w-64 py-1.5 bg-white dark:bg-[#181B1F] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* 1. Contact info */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onToggleDetails();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name="info" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  {isGroup ? "Group info" : "Contact info"}
                </span>
              </button>

              {/* 2. Search */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenSearch?.();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name="search" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  Search
                </span>
              </button>

              {/* 3. Select messages */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenSelectionMode?.();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group cursor-pointer"
              >
                <Icon name="check_box" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  Select messages
                </span>
              </button>

              {!isAi && (
                <>
                  {/* 4. Disappearing messages */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      showToast("Disappearing messages: Off");
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
                  >
                    <Icon name="timelapse" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                      Disappearing messages
                    </span>
                  </button>
                  {/* 5. Lock chat */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (!currentUser.lockedChatEnabled || !currentUser.lockedChatPasskey) {
                        router.push("/setting/privacy/lock-chats");
                        return;
                      }
                      setPasskeyInput("");
                      setPasskeyError(null);
                      setShowPasskeyModal(true);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group cursor-pointer"
                  >
                    <Icon name={isLocked ? "lock_open" : "lock"} size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                      {isLocked ? "Unlock chat" : "Lock chat"}
                    </span>
                  </button>

                  {/* 6. Add to favourites */}
                  <button
                    onClick={async () => {
                      setShowMenu(false);
                      const res = await toggleConversationFavourite(
                        currentUser.uid,
                        conversation.id,
                        currentUser
                      );
                      setIsFavourite(res.isFavourite);
                      showToast(res.isFavourite ? "Added to favourites ❤️" : "Removed from favourites");
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group cursor-pointer"
                  >
                    <Icon
                      name={isFavourite ? "favorite" : "favorite_border"}
                      size="sm"
                      className={`${isFavourite ? "text-rose-500" : "text-slate-500 dark:text-slate-400"
                        } group-hover:text-rose-500`}
                    />
                    <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                      {isFavourite ? "Remove from favourites" : "Add to favourites"}
                    </span>
                  </button>

                  {/* 7. Add to list */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowAddToListModal(true);
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <Icon name="playlist_add" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                      <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                        Add to list
                      </span>
                    </div>
                    <Icon name="chevron_right" size="xs" className="text-slate-400 dark:text-slate-500" />
                  </button>
                </>
              )}

              {/* 8. Export chat */}
              <button
                onClick={handleExportChat}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name="download" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  Export chat
                </span>
              </button>

              {/* 9. Close chat */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onBackMobile();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name="cancel" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  Close chat
                </span>
              </button>

              {!isAi && (
                <>
                  {/* Subtle divider before Send call link */}
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

                  {/* 10. Send call link */}
                  <button
                    onClick={handleSendCallLink}
                    className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
                  >
                    <Icon name="link" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                      Send call link
                    </span>
                  </button>
                </>
              )}

              {/* Subtle divider before Clear chat */}
              <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

              {/* 11. Clear chat */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setAlsoDeleteStarred(false);
                  setShowClearConfirm(true);
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name="remove_circle_outline" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  Clear chat
                </span>
              </button>

              {!isAi && (
                /* 12. Delete chat */
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition-colors group"
                >
                  <Icon name="delete" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-rose-500" />
                  <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF] group-hover:text-rose-600 dark:group-hover:text-rose-400">
                    Delete chat
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal: Clear Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Clear this chat?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Messages will be permanently removed from this conversation.
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
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowClearConfirm(false);
                  await clearConversation(conversation.id, currentUser.uid, alsoDeleteStarred);
                  showToast("Chat messages cleared");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm cursor-pointer"
              >
                Clear chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Chat */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Delete this chat?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to delete this chat with <span className="font-semibold text-slate-700 dark:text-slate-200">{name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  await deleteConversation(conversation.id, currentUser.uid);
                  showToast("Chat deleted");
                  onBackMobile();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
              >
                Delete chat
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Add to List */}
      <Modal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        title="Add to list"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Categorize this conversation:
          </p>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
            {getEffectiveChatLists(currentUser)
              .filter((l) => l.id !== "all" && l.id !== "unread" && l.id !== "groups")
              .map((list) => {
                const isMember =
                  list.id === "favourites"
                    ? isConversationFavourite(conversation.id, currentUser)
                    : Boolean(currentUser.conversationListMemberships?.[conversation.id]?.includes(list.id));
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={async () => {
                      await toggleConversationList(currentUser.uid, conversation.id, list.id, currentUser);
                      if (list.id === "favourites") {
                        setIsFavourite(!isMember);
                      }
                      showToast(`Updated "${list.label}"`);
                    }}
                    className="w-full py-2.5 px-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Icon name={list.id === "favourites" ? "star" : "label"} size="xs" />
                      </div>
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-100">
                        {list.label}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isMember
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-300 dark:border-slate-600 bg-transparent"
                        }`}
                    >
                      {isMember && <Icon name="check" size="xs" />}
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setShowAddToListModal(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Passkey Entry to Lock/Unlock Chat */}
      <Modal
        isOpen={showPasskeyModal}
        onClose={() => {
          setShowPasskeyModal(false);
          setPasskeyInput("");
          setPasskeyError(null);
        }}
        title={isLocked ? "Unlock Chat" : "Lock Chat"}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your passkey to {isLocked ? "unlock" : "lock"} this conversation.
          </p>

          <input
            type="password"
            autoFocus
            maxLength={8}
            placeholder="Enter passkey"
            value={passkeyInput}
            onChange={(e) => {
              setPasskeyInput(e.target.value);
              setPasskeyError(null);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!passkeyInput.trim()) return;
                if (isLocked) {
                  const res = await unlockConversation(currentUser.uid, conversation.id, passkeyInput, currentUser);
                  if (res.success) {
                    setIsLocked(false);
                    setShowPasskeyModal(false);
                    await refreshProfile();
                    showToast("Chat unlocked 🔓");
                  } else {
                    setPasskeyError(res.error || "Incorrect passkey");
                  }
                } else {
                  const res = await lockConversation(currentUser.uid, conversation.id, passkeyInput, currentUser);
                  if (res.success) {
                    setIsLocked(true);
                    setShowPasskeyModal(false);
                    await refreshProfile();
                    showToast("Chat locked with passkey 🔒");
                    onBackMobile();
                  } else {
                    setPasskeyError(res.error || "Incorrect passkey");
                  }
                }
              }
            }}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 tracking-widest text-center"
          />

          {passkeyError && (
            <p className="text-xs text-rose-500 font-medium text-center">{passkeyError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPasskeyModal(false);
                setPasskeyInput("");
                setPasskeyError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!passkeyInput.trim()}
              onClick={async () => {
                if (!passkeyInput.trim()) return;
                if (isLocked) {
                  const res = await unlockConversation(currentUser.uid, conversation.id, passkeyInput, currentUser);
                  if (res.success) {
                    setIsLocked(false);
                    setShowPasskeyModal(false);
                    await refreshProfile();
                    showToast("Chat unlocked 🔓");
                  } else {
                    setPasskeyError(res.error || "Incorrect passkey");
                  }
                } else {
                  const res = await lockConversation(currentUser.uid, conversation.id, passkeyInput, currentUser);
                  if (res.success) {
                    setIsLocked(true);
                    setShowPasskeyModal(false);
                    await refreshProfile();
                    showToast("Chat locked with passkey 🔒");
                    onBackMobile();
                  } else {
                    setPasskeyError(res.error || "Incorrect passkey");
                  }
                }
              }}
            >
              {isLocked ? "Unlock" : "Lock"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
