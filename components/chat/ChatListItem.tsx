import React, { useState, useEffect, useRef } from "react";
import { Conversation, UserProfile } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { subscribeToUserPresence, subscribeToTyping } from "@/lib/realtime/presenceService";

interface ChatListItemProps {
  conversation: Conversation;
  currentUser: UserProfile;
  isSelected: boolean;
  hasUnviewedStory?: boolean;
  onSelect: () => void;
  onContextMenu?: (x: number, y: number, conv: Conversation) => void;
  onAvatarClick?: (conv: Conversation, name: string, avatarUrl: string) => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  conversation,
  currentUser,
  isSelected,
  hasUnviewedStory = false,
  onSelect,
  onContextMenu,
  onAvatarClick,
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

  // Long-press (450ms) for mobile and right-click for desktop
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isLongPressTriggeredRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch (_) {}
      }
      onContextMenu?.(touchStartXRef.current, touchStartYRef.current, conversation);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // Cancel long press if user is scrolling
    if (Math.hypot(diffX, diffY) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressTriggeredRef.current) {
      e.preventDefault();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    onSelect();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e.clientX, e.clientY, conversation);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all border-b border-slate-100 dark:border-slate-800/60 select-none group relative cursor-pointer ${
        isSelected
          ? "bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-l-[#2563EB]"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
      }`}
    >
      {/* Avatar Container */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onAvatarClick?.(conversation, name, avatarUrl);
        }}
        className="relative flex-shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
        title={hasUnviewedStory ? `View ${name}'s story` : `View ${name}'s profile photo`}
      >
        {hasUnviewedStory ? (
          <div className="w-[50px] h-[50px] rounded-full p-[2px] bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] dark:from-sky-400 dark:to-teal-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <div className="w-full h-full rounded-full p-[1.5px] bg-white dark:bg-slate-900 flex items-center justify-center">
              {isGroup ? (
                avatarUrl ? (
                  <Avatar name={name} src={avatarUrl} size="md" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
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
            </div>
          </div>
        ) : (
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0">
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
          </div>
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
    </div>
  );
};
