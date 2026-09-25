"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import { ChatMessage } from "@/types";
import { MediaExpressionsModal, ExpressionTab } from "./MediaExpressionsModal";
import { AttachmentMenuPopover } from "./AttachmentMenuPopover";

interface MessageInputBarProps {
  onSendMessage: (text: string, replyTo?: ChatMessage) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  onOpenMediaModal: (file?: File) => void;
  onOpenGifModal: () => void;
  onOpenStickerModal: () => void;
  onSendGif?: (gifUrl: string) => Promise<void> | void;
  onSendSticker?: (stickerEmojiOrContent: string) => Promise<void> | void;
  onComingSoon?: (title: string, description: string, icon: string) => void;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  isAiConversation?: boolean;
}

export const MessageInputBar: React.FC<MessageInputBarProps> = ({
  onSendMessage,
  onTyping,
  onOpenMediaModal,
  onOpenGifModal,
  onOpenStickerModal,
  onSendGif,
  onSendSticker,
  onComingSoon,
  replyingTo,
  onCancelReply,
  isAiConversation,
}) => {
  const [text, setText] = useState("");
  const [isExpressionsOpen, setIsExpressionsOpen] = useState(false);
  const [expressionsTab, setExpressionsTab] = useState<ExpressionTab>("emoji");
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerContainerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea height smoothly up to 130px
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 130;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    adjustHeight();

    // Broadcast typing state with 2s debounce
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    try {
      setIsSending(true);
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Close open popovers
      setIsExpressionsOpen(false);
      setIsAttachmentOpen(false);

      await onSendMessage(trimmed, replyingTo || undefined);
      if (replyingTo) onCancelReply();

      // Return focus to textarea on desktop
      if (window.innerWidth > 768) {
        textareaRef.current?.focus();
      }
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard shortcut: Enter to send (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Insert emoji at cursor position and maintain textarea focus
  const handleSelectEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => prev + emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setText(newText);

    // Update cursor position after React re-renders
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
      adjustHeight();
    }, 0);

    onTyping(true);
  };

  // Direct file selection from native file picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenMediaModal(file);
    }
    // Reset file input so user can pick the same file again if desired
    e.target.value = "";
  };

  // Handle coming soon notifications
  const handleComingSoon = (title: string, description: string, icon: string) => {
    if (onComingSoon) {
      onComingSoon(title, description, icon);
    } else {
      onOpenMediaModal();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={composerContainerRef}
      className="relative z-20 w-full bg-transparent sm:bg-white/95 sm:dark:bg-[#0F172A]/95 sm:backdrop-blur-md sm:border-t sm:border-slate-200/80 sm:dark:border-slate-800/90 transition-colors pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      {/* Hidden file input for image picking */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
      />

      {/* Unified Media Expressions Modal (Emoji, GIF, Sticker with Tab Bar & Mobile Bottom Dock) */}
      <MediaExpressionsModal
        isOpen={isExpressionsOpen}
        onClose={() => setIsExpressionsOpen(false)}
        onSelectEmoji={handleSelectEmoji}
        onSelectGif={(gifUrl) => {
          if (onSendGif) {
            onSendGif(gifUrl);
          } else {
            onOpenGifModal();
          }
        }}
        onSelectSticker={(sticker) => {
          if (onSendSticker) {
            onSendSticker(sticker);
          } else {
            onOpenStickerModal();
          }
        }}
        initialTab={expressionsTab}
      />

      <AttachmentMenuPopover
        isOpen={isAttachmentOpen}
        onClose={() => setIsAttachmentOpen(false)}
        onSelectImage={() => {
          setIsAttachmentOpen(false);
          fileInputRef.current?.click();
        }}
        onSelectGif={() => {
          setIsAttachmentOpen(false);
          setExpressionsTab("gif");
          setIsExpressionsOpen(true);
        }}
        onSelectSticker={() => {
          setIsAttachmentOpen(false);
          setExpressionsTab("sticker");
          setIsExpressionsOpen(true);
        }}
        onSelectComingSoon={(title, description) => {
          setIsAttachmentOpen(false);
          const icon =
            title.includes("Video") ? "videocam" : title.includes("Document") ? "description" : "mic";
          handleComingSoon(title, description, icon);
        }}
      />

      {/* Reply Snippet Banner */}
      {replyingTo && (
        <div className="mx-2 sm:mx-3 mb-1.5 p-2.5 px-3.5 rounded-2xl bg-white/95 dark:bg-[#1F2C34]/95 border-l-[3.5px] border-[#00A884] border border-slate-200/60 dark:border-white/10 shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150 backdrop-blur-md">
          <div className="flex items-center gap-2.5 overflow-hidden text-xs min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#00A884]/15 flex items-center justify-center text-[#00A884] flex-shrink-0">
              <Icon name="reply" size="xs" />
            </div>
            <div className="truncate min-w-0">
              <span className="font-semibold text-[#00A884] block text-[11px] truncate">
                Replying to {replyingTo.senderName}
              </span>
              <p className="text-slate-600 dark:text-slate-300 truncate text-xs mt-0.5">
                {replyingTo.type === "image"
                  ? "📷 Photo"
                  : replyingTo.type === "gif"
                  ? "👾 GIF"
                  : replyingTo.type === "sticker"
                  ? `${replyingTo.text} Sticker`
                  : replyingTo.text}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
            title="Cancel reply"
            aria-label="Cancel reply"
          >
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}

      {/* Main Composer Controls Row */}
      <div className="flex items-end gap-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-3 sm:py-2">
        {/* Left Pill (Capsule) Container */}
        <div className="flex-1 relative flex items-center min-h-[48px] bg-white dark:bg-[#1F2C34] rounded-[24px] sm:rounded-2xl px-1 sm:px-1.5 py-0.5 shadow-sm border border-slate-200/50 dark:border-white/5 transition-all focus-within:ring-1 focus-within:ring-[#00A884]/40">
          {/* Emoji / Sticker Button (Left Inside Pill) */}
          <button
            type="button"
            onClick={() => {
              if (isExpressionsOpen) {
                setIsExpressionsOpen(false);
              } else {
                setExpressionsTab("emoji");
                setIsExpressionsOpen(true);
                if (isAttachmentOpen) setIsAttachmentOpen(false);
              }
            }}
            title="Emojis, GIFs & Stickers"
            aria-label="Choose emoji, GIF or sticker"
            className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-[#8696A0] hover:text-[#00A884] dark:hover:text-white transition-colors active:scale-90 flex-shrink-0 cursor-pointer"
          >
            {/* WhatsApp style sticker / emoji smiley icon */}
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              className="text-slate-400 dark:text-[#8696A0]"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12c0 2.3.8 4.4 2.1 6.1L4.1 21l2.9-1c1.5 1.3 3.4 2 5 2 5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 15c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5zm-2.5-6c-.83 0-1.5-.67-1.5-1.5S7.67 8 8.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5S12.67 8 13.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
          </button>

          {/* Multiline Auto-Resize Textarea with "Message" Placeholder */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Close popovers when user starts typing on keyboard
              setIsExpressionsOpen(false);
              setIsAttachmentOpen(false);
            }}
            placeholder={
              isAiConversation ? "Ask Veyra AI..." : "Message"
            }
            autoCapitalize="sentences"
            autoComplete="off"
            spellCheck={true}
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-[#8696A0] text-[16px] sm:text-sm px-1.5 py-2.5 border-none outline-none resize-none max-h-32 scrollbar-none leading-relaxed"
          />

          {/* Attachment Paperclip Button (Right Inside Pill) */}
          {!isAiConversation && (
            <button
              type="button"
              onClick={() => {
                setIsAttachmentOpen(!isAttachmentOpen);
                if (isExpressionsOpen) setIsExpressionsOpen(false);
              }}
              title="Attach media or files"
              aria-label="Attach media or files"
              className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-[#8696A0] hover:text-[#00A884] dark:hover:text-white transition-colors active:scale-90 flex-shrink-0 cursor-pointer"
            >
              {/* WhatsApp paperclip icon */}
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="rotate-[135deg]"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          )}
        </div>

        {/* Standalone Circular Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          title="Send message"
          aria-label="Send message"
          className="w-12 h-12 rounded-full bg-[#00A884] hover:bg-[#008f70] active:scale-95 transition-all flex items-center justify-center flex-shrink-0 shadow-md cursor-pointer mb-0.5"
        >
          {/* Dark directional send arrowhead matching reference */}
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            className="text-[#0B141A] ml-0.5"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
