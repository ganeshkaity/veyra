"use client";

import React, { useState } from "react";
import { Conversation, UserProfile, UserPresence, TypingIndicator } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { formatLastSeen } from "@/lib/realtime/presenceService";

interface ConversationHeaderProps {
  conversation: Conversation;
  currentUser: UserProfile;
  presence: UserPresence | null;
  typingList: TypingIndicator[];
  isAiResponding?: boolean;
  onToggleDetails: () => void;
  onBackMobile: () => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  currentUser,
  presence,
  typingList,
  isAiResponding,
  onToggleDetails,
  onBackMobile,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  return (
    <div className="relative flex items-center justify-between px-3 md:px-4 py-2.5 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 z-10 select-none">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
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
      <div className="flex items-center gap-1">
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

        <button
          onClick={onToggleDetails}
          title="Conversation Details"
          aria-label="Conversation Details"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="info" size="sm" />
        </button>
      </div>
    </div>
  );
};
