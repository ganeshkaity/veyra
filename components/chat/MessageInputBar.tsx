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
      className="relative bg-white dark:bg-[#0F172A] border-t border-slate-200/80 dark:border-slate-800/90 z-20 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
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
        <div className="mx-3 mt-2 mb-0 p-2.5 px-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border-l-[3.5px] border-[#2563EB] dark:border-[#14B8A6] border border-slate-200/60 dark:border-slate-700/60 shadow-xs flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2.5 overflow-hidden text-xs min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#2563EB]/10 dark:bg-[#14B8A6]/15 flex items-center justify-center text-[#2563EB] dark:text-[#14B8A6] flex-shrink-0">
              <Icon name="reply" size="xs" />
            </div>
            <div className="truncate min-w-0">
              <span className="font-semibold text-[#2563EB] dark:text-[#14B8A6] block text-[11px] truncate">
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
      <div className="flex items-end gap-1.5 px-2.5 sm:px-3 py-2">
        {/* Attachment Menu (+) Button */}
        {!isAiConversation && (
          <button
            type="button"
            onClick={() => {
              setIsAttachmentOpen(!isAttachmentOpen);
              if (isExpressionsOpen) setIsExpressionsOpen(false);
            }}
            title="Attach media or files"
            aria-label="Attach media or files"
            className={`p-2.5 rounded-xl transition-all flex-shrink-0 mb-0.5 active:scale-95 ${
              isAttachmentOpen
                ? "bg-[#2563EB]/15 dark:bg-[#14B8A6]/20 text-[#2563EB] dark:text-[#14B8A6]"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#2563EB] dark:hover:text-[#14B8A6]"
            }`}
          >
            <Icon name={isAttachmentOpen ? "close" : "add"} size="md" />
          </button>
        )}

        {/* Single Unified Expressions Button (Emoji / GIF / Sticker Modal) */}
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
          className={`p-2.5 rounded-xl transition-all flex-shrink-0 mb-0.5 active:scale-95 ${
            isExpressionsOpen
              ? "bg-[#2563EB]/15 dark:bg-[#14B8A6]/20 text-[#2563EB] dark:text-[#14B8A6]"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#2563EB] dark:hover:text-[#14B8A6]"
          }`}
        >
          <Icon name="mood" size="md" />
        </button>

        {/* Text Input Container with Auto-Resize Multiline Textarea */}
        <div className="flex-1 relative flex items-center min-w-0 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-transparent focus-within:border-[#2563EB]/40 dark:focus-within:border-[#14B8A6]/40 focus-within:ring-2 focus-within:ring-[#2563EB]/15 dark:focus-within:ring-[#14B8A6]/15 transition-all">
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
              isAiConversation ? "Ask Veyra AI anything..." : "Type a message..."
            }
            autoCapitalize="sentences"
            autoComplete="off"
            spellCheck={true}
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm px-3.5 sm:px-4 py-2.5 border-none outline-none resize-none max-h-32 scrollbar-none leading-relaxed"
          />
        </div>

        {/* Action Button: Send vs Coming Soon Mic */}
        {text.trim() ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            title="Send message (Enter)"
            aria-label="Send message"
            className="p-2.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white shadow-md shadow-blue-500/25 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center flex-shrink-0 mb-0.5"
          >
            <Icon name="send" size="sm" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              handleComingSoon(
                "Voice Messaging",
                "Voice notes, waveforms, and audio recordings are coming soon in Veyra V2.",
                "mic"
              )
            }
            title="Voice message (Coming Soon)"
            aria-label="Voice message"
            className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0 mb-0.5 active:scale-95"
          >
            <Icon name="mic" size="sm" />
          </button>
        )}
      </div>
    </div>
  );
};
