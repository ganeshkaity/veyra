import React, { useState, useEffect } from "react";
import { Conversation, UserProfile } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { subscribeToUserPresence, subscribeToTyping } from "@/lib/realtime/presenceService";

interface ChatListItemProps {
  conversation: Conversation;
  currentUser: UserProfile;
  isSelected: boolean;
  onSelect: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  conversation,
  currentUser,
  isSelected,
  onSelect,
}) => {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);

  // Determine title and avatar based on direct vs group vs ai
  let name = "";
  let avatarUrl = "";
  let username = "";
  const isGroup = conversation.type === "group";
  const isAi = conversation.type === "ai";

  const otherId = conversation.participantIds.find((id) => id !== currentUser.uid);

  if (isGroup) {
    name = conversation.groupName || "Group";
    avatarUrl = conversation.groupAvatar || "";
  } else if (isAi) {
    name = "Veyra AI";
    avatarUrl = "/assets/veyra_ai_logo.png";
    username = "veyra_ai";
  } else {
    // Find the other participant
    const other = otherId ? conversation.participants[otherId] : null;
    name = other?.displayName || "User";
    avatarUrl = other?.avatarUrl || "";
    username = other?.username || "";
  }

  // Subscribe to live presence for direct 1-to-1 conversations
  useEffect(() => {
    if (isGroup || isAi || !otherId) {
      setIsOnline(undefined);
      return;
    }

    const unsub = subscribeToUserPresence(otherId, (presence) => {
      setIsOnline(presence?.isOnline ?? false);
    });

    return () => unsub();
  }, [isGroup, isAi, otherId]);

  const [typingList, setTypingList] = useState<any[]>([]);

  // Subscribe to live typing in this conversation
  useEffect(() => {
    if (isAi) return;
    const unsub = subscribeToTyping(conversation.id, currentUser.uid, (list) => {
      setTypingList(list);
    });
    return () => unsub();
  }, [conversation.id, currentUser.uid, isAi]);

  // Format timestamp intelligently
  const formatTime = (ts?: number) => {
    if (!ts) return "";
    const date = new Date(ts);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return "Yesterday";

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const unread = conversation.unreadCount?.[currentUser.uid] || 0;
  const isLastSenderSelf = conversation.lastMessage?.senderId === currentUser.uid;
  const isRead = conversation.lastMessage?.status === "read";
  const isDelivered = conversation.lastMessage?.status === "delivered";

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all border-b border-slate-100 dark:border-slate-800/60 select-none group relative ${
        isSelected
          ? "bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-l-[#2563EB]"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
      }`}
    >
      {/* Avatar Container */}
      <div className="relative flex-shrink-0">
        {isGroup ? (
          avatarUrl ? (
            <Avatar name={name} src={avatarUrl} size="md" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <Icon name="groups" size="sm" />
            </div>
          )
        ) : (
          <Avatar
            name={name}
            src={avatarUrl}
            size="md"
            isOnline={isAi ? undefined : isOnline}
          />
        )}

        {isAi && (
          <span className="absolute -bottom-1 -right-1 bg-gradient-to-tr from-teal-500 to-emerald-400 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-900 shadow-sm">
            <Icon name="auto_awesome" size="xs" />
          </span>
        )}
      </div>

      {/* Info Container */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <div className="flex items-center gap-1.5 truncate">
            <h4
              className={`text-sm truncate ${
                unread > 0
                  ? "font-bold text-slate-900 dark:text-white"
                  : "font-semibold text-slate-800 dark:text-slate-200"
              }`}
            >
              {name}
            </h4>
          </div>

          <span
            className={`text-[11px] font-medium ml-2 flex-shrink-0 ${
              unread > 0
                ? "text-[#2563EB] font-bold"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {formatTime(conversation.lastMessage?.timestamp || conversation.updatedAt)}
          </span>
        </div>

        {/* Message preview snippet or typing state */}
        <div className="flex justify-between items-center gap-2">
          {typingList.length > 0 ? (
            <p className="text-xs text-emerald-500 dark:text-emerald-400 font-semibold truncate animate-pulse flex items-center gap-1">
              <span>{typingList[0].displayName || "Someone"} is typing...</span>
            </p>
          ) : (
            <p
              className={`text-xs truncate max-w-[85%] flex items-center gap-1 ${
                unread > 0
                  ? "text-slate-900 dark:text-slate-100 font-semibold"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {isLastSenderSelf && (
                <span
                  className={`font-bold text-xs select-none flex-shrink-0 ${
                    isRead ? "text-[#2563EB]" : "text-slate-400"
                  }`}
                  title={isRead ? "Read" : isDelivered ? "Delivered" : "Sent"}
                >
                  {isDelivered || isRead ? "✓✓" : "✓"}
                </span>
              )}
              <span className="truncate">
                {conversation.lastMessage?.text || (isAi ? "Always here to help you." : "No messages yet")}
              </span>
            </p>
          )}

          {unread > 0 && (
            <Badge count={unread} variant="brand" className="shadow-sm flex-shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
};
