"use client";

import React, { useState, useRef } from "react";
import { ChatMessage, UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { ImageMessage } from "./media/ImageMessage";
import { GifMessage } from "./media/GifMessage";
import { StickerMessage } from "./media/StickerMessage";
import { ChatMessageMarkdown } from "./ChatMessageMarkdown";

interface MessageItemProps {
  message: ChatMessage;
  currentUser: UserProfile;
  showDateSeparator?: string | null;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onOpenImageViewer?: (message: ChatMessage) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUser,
  showDateSeparator,
  isFirstInGroup = true,
  isLastInGroup = true,
  onReply,
  onForward,
  onEdit,
  onDeleteForEveryone,
  onDeleteForMe,
  onOpenImageViewer,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Swipe-to-reply touch tracking
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isHorizontalSwipeRef = useRef(false);

  // If deleted for current user, hide completely
  if (message.deletedForUsers?.includes(currentUser.uid)) {
    return null;
  }

  const isMe = message.senderId === currentUser.uid;
  const now = Date.now();
  const ageMs = now - message.createdAt;
  const isDeleted = message.isDeletedForEveryone || message.deletedForEveryone;
  const isEdited = message.isEdited || message.edited;
  
  // Rules: Edit allowed only within 2 days (172800000ms), Delete for everyone within 1 day (86400000ms)
  const canEdit = isMe && !isDeleted && ageMs <= 2 * 24 * 60 * 60 * 1000;
  const canDeleteForEveryone = isMe && !isDeleted && ageMs <= 24 * 60 * 60 * 1000;

  // Localized time formatting
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Grouped bubble border radius classes
  const getBubbleRadius = () => {
    if (isMe) {
      if (isFirstInGroup && isLastInGroup) return "rounded-2xl rounded-br-sm";
      if (isFirstInGroup) return "rounded-2xl rounded-br-md";
      if (isLastInGroup) return "rounded-2xl rounded-tr-md rounded-br-sm";
      return "rounded-2xl rounded-r-md";
    } else {
      if (isFirstInGroup && isLastInGroup) return "rounded-2xl rounded-bl-sm";
      if (isFirstInGroup) return "rounded-2xl rounded-bl-md";
      if (isLastInGroup) return "rounded-2xl rounded-tl-md rounded-bl-sm";
      return "rounded-2xl rounded-l-md";
    }
  };

  // Scroll to original replied message
  const handleScrollToReplied = (targetMsgId: string) => {
    const el = document.querySelector(`[data-message-id="${targetMsgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[#2563EB]", "ring-offset-2", "transition-all", "duration-500");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-[#2563EB]", "ring-offset-2");
      }, 1500);
    }
  };

  // Mobile Swipe-to-Reply touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleted) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDeleted) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // Detect if movement is primarily horizontal
    if (!isHorizontalSwipeRef.current) {
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
        isHorizontalSwipeRef.current = true;
      } else if (Math.abs(diffY) > 10) {
        return; // User is scrolling vertically
      }
    }

    if (isHorizontalSwipeRef.current && diffX > 0) {
      // Swiping right to trigger reply
      const bounded = Math.min(diffX * 0.45, 65);
      setSwipeOffset(bounded);
    }
  };

  const handleTouchEnd = () => {
    if (isDeleted) return;
    if (swipeOffset >= 45) {
      // Trigger reply
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(20);
        } catch (_) {}
      }
      onReply(message);
    }
    setSwipeOffset(0);
    isHorizontalSwipeRef.current = false;
  };

  return (
    <div
      data-message-id={message.id}
      data-sender-id={message.senderId}
      data-status={message.status}
      className={`flex flex-col relative ${isFirstInGroup ? "mt-2.5" : "mt-0.5"}`}
    >
      {/* Date Separator */}
      {showDateSeparator && (
        <div className="flex justify-center my-3 select-none">
          <span className="px-3.5 py-1 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-[11px] font-bold text-slate-500 dark:text-slate-300 shadow-sm border border-slate-200/60 dark:border-slate-700/60 uppercase tracking-wider">
            {showDateSeparator}
          </span>
        </div>
      )}

      {/* Deleted For Everyone: System-like message */}
      {isDeleted ? (
        <div className="flex justify-center my-1.5 select-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs italic border border-slate-200/60 dark:border-slate-700/50 shadow-xs">
            <Icon name="block" size="xs" className="text-slate-400 dark:text-slate-500" />
            <span>Oh, the message was deleted</span>
            <span className="text-[10px] opacity-70 ml-1 font-sans not-italic">
              {formatTime(message.createdAt)}
            </span>
          </div>
        </div>
      ) : (
        /* Regular Message Container */
        <div
          className={`group relative flex items-end gap-1.5 ${
            isMe ? "justify-end" : "justify-start"
          }`}
          onMouseLeave={() => setShowMenu(false)}
        >
          {/* Mobile Swipe Reply Indicator Icon */}
          {swipeOffset > 0 && (
            <div
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#2563EB]/15 dark:bg-[#14B8A6]/20 flex items-center justify-center text-[#2563EB] dark:text-[#14B8A6] pointer-events-none transition-all duration-100"
              style={{
                opacity: Math.min(swipeOffset / 45, 1),
                transform: `translateY(-50%) scale(${0.7 + (swipeOffset / 45) * 0.3})`,
              }}
            >
              <Icon name="reply" size="xs" />
            </div>
          )}

          {/* Desktop Context Menu Toggle */}
          <div
            className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${
              isMe ? "order-first" : "order-last"
            }`}
          >
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10"
              title="Message options"
              aria-label="Message options"
            >
              <Icon name="more_vert" size="xs" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div
                className={`absolute z-30 bottom-8 ${
                  isMe ? "right-4" : "left-4"
                } w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-xs animate-in fade-in zoom-in-95`}
              >
                {/* Reply */}
                <button
                  onClick={() => {
                    onReply(message);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <Icon name="reply" size="xs" className="text-slate-500" />
                  <span>Reply</span>
                </button>

                {/* Forward */}
                <button
                  onClick={() => {
                    onForward(message);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <Icon name="forward" size="xs" className="text-slate-500" />
                  <span>Forward</span>
                </button>

                {/* Edit (only within 2 days and text messages) */}
                {canEdit && message.type === "text" && (
                  <button
                    onClick={() => {
                      onEdit(message);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Icon name="edit" size="xs" className="text-slate-500" />
                    <span>Edit message</span>
                  </button>
                )}

                {/* Delete for Me */}
                <button
                  onClick={() => {
                    onDeleteForMe(message.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <Icon name="delete" size="xs" className="text-slate-500" />
                  <span>Delete for me</span>
                </button>

                {/* Delete for Everyone (only author, within 1 day) */}
                {canDeleteForEveryone && (
                  <button
                    onClick={() => {
                      onDeleteForEveryone(message.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800"
                  >
                    <Icon name="delete_forever" size="xs" className="text-red-500" />
                    <span>Delete for everyone</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Swipeable Bubble Container */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? "transform 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28)" : "none",
            }}
            className={`max-w-[88%] sm:max-w-[78%] md:max-w-[72%] min-w-0 select-text ${
              message.type === "sticker"
                ? "bg-transparent shadow-none p-1"
                : `${getBubbleRadius()} p-2.5 px-3.5 shadow-sm ${
                    isMe
                      ? "bg-[var(--bubble-outgoing)] text-[var(--bubble-outgoing-text)]"
                      : "bg-[var(--bubble-incoming)] text-[var(--bubble-incoming-text)] border border-slate-100 dark:border-slate-800/80"
                  }`
            }`}
          >
            {/* Forwarded Header */}
            {message.forwarded && (
              <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-400 italic mb-1.5 select-none">
                <Icon name="forward" size="xs" />
                <span>Forwarded</span>
              </div>
            )}

            {/* Sender Name (in groups) */}
            {!isMe && message.senderName && isFirstInGroup && (
              <span className="block text-[11px] font-bold text-[#2563EB] dark:text-[#14B8A6] mb-1 select-none">
                {message.senderName}
              </span>
            )}

            {/* Replying quote snippet with visual relationship */}
            {message.replyTo && (
              <div
                onClick={() => handleScrollToReplied(message.replyTo!.messageId)}
                className="mb-2 p-1.5 px-2.5 rounded-lg bg-black/5 dark:bg-white/10 border-l-[3px] border-[#2563EB] dark:border-[#14B8A6] text-[11px] cursor-pointer hover:opacity-90 transition-opacity select-none"
                title="Click to view replied message"
              >
                <div className="flex items-center gap-1 font-semibold text-[#2563EB] dark:text-[#14B8A6]">
                  <Icon name="reply" size="xs" className="w-3 h-3" />
                  <span>{message.replyTo.senderName}</span>
                </div>
                <p className="truncate opacity-80 mt-0.5 line-clamp-1">{message.replyTo.text}</p>
              </div>
            )}

            {/* Image Content with Lightbox */}
            {message.type === "image" && message.mediaUrl && (
              <ImageMessage
                message={message}
                onOpenViewer={(m) => onOpenImageViewer?.(m)}
              />
            )}

            {/* GIF Content */}
            {message.type === "gif" && message.mediaUrl && (
              <GifMessage message={message} />
            )}

            {/* Sticker Content */}
            {message.type === "sticker" && (
              <StickerMessage message={message} />
            )}

            {/* Text Content (Markdown + Typewriter Code Support) */}
            {message.type !== "sticker" && message.type !== "image" && message.type !== "gif" && (
              <ChatMessageMarkdown content={message.text} isMe={isMe} />
            )}

            {/* Footer: Pencil icon for edited (NO large EDITED label), Timestamp, Read receipts */}
            <div
              className={`flex items-center gap-1 justify-end text-[10px] mt-1 select-none ${
                isMe ? "text-slate-500 dark:text-slate-300" : "text-slate-400"
              }`}
            >
              {/* Sleek micro pencil icon when edited */}
              {isEdited && (
                <span
                  title="Edited"
                  className="inline-flex items-center text-slate-400 dark:text-slate-400/80 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <svg
                    className="w-2.5 h-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </span>
              )}

              <span>{formatTime(message.createdAt)}</span>

              {isMe && (
                <span
                  className={
                    message.status === "read"
                      ? "text-[var(--bubble-tick)] font-bold text-[11px]"
                      : "text-slate-400 dark:text-slate-500 font-bold text-[11px]"
                  }
                  title={
                    message.status === "read"
                      ? "Read"
                      : message.status === "delivered"
                      ? "Delivered"
                      : "Sent"
                  }
                >
                  {message.status === "sent" ? "✓" : "✓✓"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
