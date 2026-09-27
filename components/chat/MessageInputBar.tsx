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
            {/* WhatsApp style sticker / emoji  smiley icon */}
            {/* <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M2 12C2 17.5228 6.47715 22 12 22C12.6477 22 13.2503 21.7004 13.7083 21.2424L21.2424 13.7083C21.7004 13.2503 22 12.6477 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12Z" stroke="#6c7080ff" stroke-width="1.5"></path> <path d="M12 17C10.8846 17 9.85038 16.6303 9 16" stroke="#6c7080ff" stroke-width="1.5" stroke-linecap="round"></path> <ellipse cx="15" cy="10.5" rx="1" ry="1.5" fill="#6c7080ff"></ellipse> <ellipse cx="9" cy="10.5" rx="1" ry="1.5" fill="#6c7080ff"></ellipse> <path d="M12 22C12 19.2071 12 17.8107 12.3928 16.688C13.0964 14.6773 14.6773 13.0964 16.688 12.3928C17.8107 12 19.2071 12 22 12" stroke="#6c7080ff" stroke-width="1.5"></path> </g></svg> */}
            <Icon name="sentiment_satisfied" size="md" />
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
              isAiConversation ? "Ask Veyra AI..." : "Type Message"
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
              {/* <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="rotate-[135deg]"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg> */}
              <Icon name="attach_file" size="md" />
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
