"use client";

import React, { useState, useRef } from "react";
import { ChatMessage, UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { ImageMessage } from "./media/ImageMessage";
import { GifMessage } from "./media/GifMessage";
import { StickerMessage } from "./media/StickerMessage";
import { ChatMessageMarkdown } from "./ChatMessageMarkdown";
import { WhatsAppForwardIcon } from "./WhatsAppForwardIcon";

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

  // Swipe-to-reply & Long-press touch tracking
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isHorizontalSwipeRef = useRef(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

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

  // Mobile Touch handlers: Swipe-to-reply and Click-and-Hold (Long Press)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleted) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = false;
    isLongPressTriggeredRef.current = false;

    // Start 450ms long-press timer for mobile context menu
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setShowMenu(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch (_) { }
      }
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDeleted) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // If movement exceeds 8px, cancel long-press
    if (Math.hypot(diffX, diffY) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (isLongPressTriggeredRef.current) return;

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
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      setSwipeOffset(0);
      isHorizontalSwipeRef.current = false;
      return;
    }
    if (isDeleted) return;
    if (swipeOffset >= 45) {
      // Trigger reply
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(20);
        } catch (_) { }
      }
      onReply(message);
    }
    setSwipeOffset(0);
    isHorizontalSwipeRef.current = false;
  };

  // Action helpers matching WhatsApp context menu
  const handleCopy = () => {
    setShowMenu(false);
    const content = message.text || message.mediaUrl || "";
    if (content && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        setToastMessage("Copied to clipboard");
        setTimeout(() => setToastMessage(null), 2000);
      });
    }
  };

  const handleDownload = async () => {
    setShowMenu(false);
    if (message.mediaUrl) {
      try {
        const response = await fetch(message.mediaUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const ext = message.type === "gif" ? "gif" : "jpg";
        link.download = message.mediaMetadata?.fileName || `veyra-${message.type}-${message.id}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setToastMessage("Downloaded media");
        setTimeout(() => setToastMessage(null), 2000);
      } catch {
        window.open(message.mediaUrl, "_blank");
      }
    } else if (message.text) {
      const blob = new Blob([message.text], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `veyra-message-${message.id}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setToastMessage("Downloaded message text");
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  const handleSelectReaction = (emoji: string) => {
    setSelectedReaction((prev) => (prev === emoji ? null : emoji));
    setShowMenu(false);
    setToastMessage(`Reacted ${emoji}`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleToggleStar = () => {
    setShowMenu(false);
    setIsStarred((prev) => {
      const next = !prev;
      setToastMessage(next ? "Message starred" : "Message unstarred");
      setTimeout(() => setToastMessage(null), 2000);
      return next;
    });
  };

  const handleTogglePin = () => {
    setShowMenu(false);
    setIsPinned((prev) => {
      const next = !prev;
      setToastMessage(next ? "Message pinned" : "Message unpinned");
      setTimeout(() => setToastMessage(null), 2000);
      return next;
    });
  };

  const handleAskVeyraAi = () => {
    setShowMenu(false);
    setToastMessage("Copied prompt for Veyra AI");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`Explain or summarize this message: "${message.text || 'this media'}"`);
    }
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Check if media message (image/gif) has an actual text caption
  const isImageOrGif =
    (message.type === "image" || message.type === "gif") && Boolean(message.mediaUrl);
  const hasCaption = Boolean(
    isImageOrGif &&
    message.text &&
    message.text.trim() !== "" &&
    message.text.trim().toLowerCase() !== "photo" &&
    message.text.trim().toLowerCase() !== "gif"
  );
  const isMediaWithoutCaption = isImageOrGif && !hasCaption;

  // Floating timestamp overlay for media with no caption (WhatsApp style)
  const floatingMediaTimestamp = (
    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] flex items-center gap-1 select-none pointer-events-none shadow-sm z-10">
      {isEdited && (
        <svg
          className="w-2.5 h-2.5 text-white/90"
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
      )}

      <span className="font-medium text-[10px] leading-none text-white/95">
        {formatTime(message.createdAt)}
      </span>

      {isMe && (
        <span
          className={
            message.status === "read"
              ? "text-[var(--bubble-tick)] font-bold text-[11px] leading-none"
              : "text-white/80 font-bold text-[11px] leading-none"
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
  );

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
          className={`group relative flex items-end gap-1.5 ${isMe ? "justify-end" : "justify-start"
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

          {/* Quick Forward Button (Always visible beside the chat bubble) */}
          <div
            className={`flex items-center flex-shrink-0 self-center ${isMe ? "order-first" : "order-last"
              }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onForward(message);
              }}
              className="p-1.5 rounded-full text-slate-400 hover:text-[#2563EB] dark:text-slate-400 dark:hover:text-[#14B8A6] hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all duration-150 cursor-pointer"
              title="Forward message"
              aria-label="Forward message"
            >
              <WhatsAppForwardIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Swipeable Bubble Container (Triggers Context Menu on Right Click or Mobile Long Press) */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(true);
            }}
            style={{
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? "transform 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28)" : "none",
            }}
            className={`relative max-w-[88%] sm:max-w-[78%] md:max-w-[72%] min-w-0 select-text cursor-pointer ${message.type === "sticker"
                ? "bg-transparent shadow-none p-1"
                : isMediaWithoutCaption
                  ? `${getBubbleRadius()} p-1 shadow-sm ${isMe
                    ? "bg-[var(--bubble-outgoing)] text-[var(--bubble-outgoing-text)]"
                    : "bg-[var(--bubble-incoming)] text-[var(--bubble-incoming-text)] border border-slate-100 dark:border-slate-800/80"
                  }`
                  : `${getBubbleRadius()} p-2.5 px-3.5 shadow-sm ${isMe
                    ? "bg-[var(--bubble-outgoing)] text-[var(--bubble-outgoing-text)]"
                    : "bg-[var(--bubble-incoming)] text-[var(--bubble-incoming-text)] border border-slate-100 dark:border-slate-800/80"
                  }`
              }`}
          >
            {/* Forwarded Header */}
            {message.forwarded && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-400 italic mb-1.5 select-none">
                <WhatsAppForwardIcon className="w-3.5 h-3.5 opacity-80" />
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
                hasCaption={hasCaption}
                onOpenViewer={(m) => onOpenImageViewer?.(m)}
              >
                {!hasCaption && floatingMediaTimestamp}
              </ImageMessage>
            )}

            {/* GIF Content */}
            {message.type === "gif" && message.mediaUrl && (
              <GifMessage message={message} hasCaption={hasCaption}>
                {!hasCaption && floatingMediaTimestamp}
              </GifMessage>
            )}

            {/* Sticker Content */}
            {message.type === "sticker" && (
              <StickerMessage message={message} />
            )}

            {/* Caption Text Content if media has caption */}
            {isImageOrGif && hasCaption && (
              <div className="pt-1.5 px-1">
                <ChatMessageMarkdown content={message.text} isMe={isMe} />
              </div>
            )}

            {/* Regular Text Content (for non-media) */}
            {message.type !== "sticker" && !isImageOrGif && (
              <ChatMessageMarkdown content={message.text} isMe={isMe} />
            )}

            {/* Footer: Only shown when there IS a caption or for regular messages */}
            {!isMediaWithoutCaption && (
              <div
                className={`flex items-center gap-1 justify-end text-[10px] mt-1 select-none ${isMe ? "text-slate-500 dark:text-slate-300" : "text-slate-400"
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

                {isPinned && (
                  <span title="Pinned" className="text-teal-500">
                    <Icon name="push_pin" size="xs" className="!text-[12px]" fill />
                  </span>
                )}
                {isStarred && (
                  <span title="Starred" className="text-amber-400">
                    <Icon name="star" size="xs" className="!text-[12px]" fill />
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
            )}

            {/* Reaction badge under bubble if user reacted */}
            {selectedReaction && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReaction(null);
                }}
                className="absolute -bottom-2.5 right-3 z-10 px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm text-xs select-none hover:scale-110 active:scale-95 transition-transform"
                title="Click to remove reaction"
              >
                {selectedReaction}
              </div>
            )}

            {/* WhatsApp-Style Full Context Menu */}
            {showMenu && (
              <>
                {/* Fullscreen Backdrop for click-outside */}
                <div
                  className="fixed inset-0 z-40 bg-black/10 dark:bg-black/35 backdrop-blur-[0.5px] cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />

                {/* Dropdown Menu Container */}
                <div
                  className={`absolute z-50 ${isMe ? "right-0" : "left-0"
                    } bottom-2 sm:bottom-4 w-52 max-h-[85vh] overflow-y-auto bg-white/98 dark:bg-[#18222d]/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-700/80 py-1.5 text-xs animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100 select-none divide-y divide-slate-100 dark:divide-slate-800/70`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Quick Reactions Bar */}
                  <div className="flex items-center justify-around px-2 py-1 pb-2">
                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleSelectReaction(emoji)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-base transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Context Actions matching WhatsApp specification */}
                  <div className="py-1">
                    {/* Message info */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowInfoModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <Icon name="info" size="xs" className="text-slate-400 dark:text-slate-400" />
                      <span>Message info</span>
                    </button>

                    {/* Reply */}
                    <button
                      type="button"
                      onClick={() => {
                        onReply(message);
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <Icon name="reply" size="xs" className="text-slate-400 dark:text-slate-400" />
                      <span>Reply</span>
                    </button>

                    {/* Copy */}
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <Icon name="content_copy" size="xs" className="text-slate-400 dark:text-slate-400" />
                      <span>Copy</span>
                    </button>

                    {/* React */}
                    <button
                      type="button"
                      onClick={() => handleSelectReaction("❤️")}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <Icon name="add_reaction" size="xs" className="text-slate-400 dark:text-slate-400" />
                      <span>React</span>
                    </button>

                    {/* Download */}
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <Icon name="download" size="xs" className="text-slate-400 dark:text-slate-400" />
                      <span>Download</span>
                    </button>

                    {/* Forward */}
                    <button
                      type="button"
                      onClick={() => {
                        onForward(message);
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <WhatsAppForwardIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                      <span>Forward</span>
                    </button>

                    {/* Pin */}
                    <button
                      type="button"
                      onClick={handleTogglePin}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <Icon name="push_pin" size="xs" className="text-slate-400 dark:text-slate-400" />
                      <span>{isPinned ? "Unpin" : "Pin"}</span>
                    </button>

                    {/* Ask Veyra AI (matching Ask Meta AI) */}
                    <button
                      type="button"
                      onClick={handleAskVeyraAi}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <img src="/assets/veyra_ai_logo.png" alt="AI" className="w-full h-full object-contain" />
                      </div>
                      <span>Ask Veyra AI</span>
                    </button>

                    {/* Star */}
                    <button
                      type="button"
                      onClick={handleToggleStar}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                    >
                      <Icon
                        name="star"
                        size="xs"
                        className={isStarred ? "text-amber-400" : "text-slate-400 dark:text-slate-400"}
                        fill={isStarred}
                      />
                      <span>{isStarred ? "Unstar" : "Star"}</span>
                    </button>

                    {/* Edit message (only within 2 days and text messages) */}
                    {canEdit && message.type === "text" && (
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(message);
                          setShowMenu(false);
                        }}
                        className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/90 transition-colors cursor-pointer"
                      >
                        <Icon name="edit" size="xs" className="text-slate-400 dark:text-slate-400" />
                        <span>Edit message</span>
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                    >
                      <Icon name="delete" size="xs" className="text-red-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Message Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setShowInfoModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Icon name="info" size="sm" className="text-[#2563EB] dark:text-[#14B8A6]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Message Info</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Sent by</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {isMe ? "You" : message.senderName || "User"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Sent at</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(message.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold capitalize text-[#2563EB] dark:text-[#14B8A6]">
                  {message.status}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Type</span>
                <span className="font-medium capitalize text-slate-800 dark:text-slate-200">
                  {message.type}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-xs bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 space-y-3 animate-in fade-in zoom-in-95 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
              <Icon name="delete" size="sm" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete message?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose whether to delete this message for everyone or only for yourself.
            </p>

            <div className="space-y-2 pt-2">
              {canDeleteForEveryone && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteForEveryone(message.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Delete for everyone
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onDeleteForMe(message.id);
                  setShowDeleteConfirm(false);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                Delete for me
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-medium shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 select-none pointer-events-none">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
