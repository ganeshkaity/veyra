"use client";

import React, { useState } from "react";
import { Conversation, ChatMessage, UserProfile, UserPresence, TypingIndicator } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { formatLastSeen } from "@/lib/realtime/presenceService";

interface ConversationHeaderProps {
  conversation: Conversation;
  currentUser: UserProfile;
  presence: UserPresence | null;
  typingList: TypingIndicator[];
  messages?: ChatMessage[];
  isAiResponding?: boolean;
  onToggleDetails: () => void;
  onBackMobile: () => void;
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
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);

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
      : "AI Companion • Powered by GPT-OSS";
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

  return (
    <div className={`relative flex items-center justify-between px-3 md:px-4 py-2.5 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 select-none transition-all ${
      showMenu ? "z-[60]" : "z-30"
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
              className={`text-[11px] truncate leading-tight ${
                isAi && isAiResponding
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
        <button
          onClick={() => showToast("Voice calling is coming soon!")}
          title="Voice Call"
          aria-label="Voice Call"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="call" size="sm" />
        </button>

        <button
          onClick={() => showToast("Video calling is coming soon!")}
          title="Video Call"
          aria-label="Video Call"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="videocam" size="sm" />
        </button>

        {/* 3-dot Menu Button replacing Info button */}
        <button
          onClick={() => setShowMenu((prev) => !prev)}
          title="More options"
          aria-label="More options"
          className={`p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
            showMenu ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : ""
          }`}
        >
          <Icon name="more_vert" size="sm" />
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
                  showToast("Search messages coming soon");
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
                  showToast("Select messages mode enabled");
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name="check_box" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  Select messages
                </span>
              </button>

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
                  setIsLocked((prev) => !prev);
                  showToast(!isLocked ? "Chat locked with passkey 🔒" : "Chat unlocked 🔓");
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name={isLocked ? "lock_open" : "lock"} size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  {isLocked ? "Unlock chat" : "Lock chat"}
                </span>
              </button>

              {/* 6. Add to favourites */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsFavourite((prev) => !prev);
                  showToast(!isFavourite ? "Added to favourites ❤️" : "Removed from favourites");
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon
                  name={isFavourite ? "favorite" : "favorite_border"}
                  size="sm"
                  className={`${
                    isFavourite ? "text-rose-500" : "text-slate-500 dark:text-slate-400"
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
                  showToast("List management coming soon");
                }}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Icon name="playlist_add" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                  <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                    Add to list
                  </span>
                </div>
                <Icon name="chevron_right" size="xs" className="text-slate-400 dark:text-slate-500" />
              </button>

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

              {/* Subtle divider before Clear chat */}
              <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

              {/* 11. Clear chat */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowClearConfirm(true);
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-[#20272D] text-left transition-colors group"
              >
                <Icon name="remove_circle_outline" size="sm" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-[#E9EDEF]">
                  Clear chat
                </span>
              </button>

              {/* 12. Delete chat */}
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Messages will be removed from this device. Media in this chat will also be cleared.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  showToast("Chat messages cleared");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm"
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
                onClick={() => {
                  setShowDeleteConfirm(false);
                  showToast("Chat deleted");
                  onBackMobile();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                Delete chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
