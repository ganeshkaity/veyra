"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Conversation, ChatMessage, UserProfile, UserPresence, TypingIndicator } from "@/types";
import { ConversationHeader } from "./ConversationHeader";
import { MessageItem } from "./MessageItem";
import { MessageInputBar } from "./MessageInputBar";
import { DetailsPanel } from "./DetailsPanel";
import { MediaAttachmentModal } from "./MediaAttachmentModal";
import { GifPickerModal } from "./GifPickerModal";
import { StickerPickerModal } from "./StickerPickerModal";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { ImageViewerModal } from "./media/ImageViewerModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageListSkeleton } from "@/components/ui/Skeleton";
import { VeyraAiWelcomeCard } from "@/components/ai/VeyraAiWelcomeCard";
import { UniversalChatWallpaper } from "./UniversalChatWallpaper";
import {
  sendPromptToVeyraAi,
  AiChatMessage,
  VEYRA_AI_PROFILE,
} from "@/lib/ai/aiService";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  subscribeToMessages,
  sendMessage,
  editMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  markConversationAsRead,
  markMessagesAsDelivered,
  markSpecificMessagesAsRead,
} from "@/lib/firestore/conversationService";
import {
  subscribeToUserPresence,
  subscribeToTyping,
  setTypingStatus,
} from "@/lib/realtime/presenceService";

interface ConversationViewProps {
  conversation: Conversation;
  currentUser: UserProfile;
  onBackMobile: () => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  currentUser,
  onBackMobile,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messageLimit, setMessageLimit] = useState(25);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Modals
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaFileToUpload, setMediaFileToUpload] = useState<File | null>(null);
  const [comingSoonInfo, setComingSoonInfo] = useState<{
    title: string;
    description: string;
    icon: string;
  } | null>(null);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);

  // Reply, Edit, Forward & Viewer state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [viewerMessage, setViewerMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [actionErrorToast, setActionErrorToast] = useState<string | null>(null);

  // Presence & Typing
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [typingList, setTypingList] = useState<TypingIndicator[]>([]);
  const [isAiResponding, setIsAiResponding] = useState(false);

  // Scroll containers and refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);

  // Determine other user's UID for 1-to-1 presence
  const otherUid = conversation.participantIds.find((id) => id !== currentUser.uid);

  // Reset pagination when conversation changes
  useEffect(() => {
    setMessageLimit(25);
    setHasMore(false);
    setIsLoadingOlder(false);
    isNearBottomRef.current = true;
  }, [conversation.id]);

  // Subscribe to real-time messages with dynamic limit (lazy loading)
  useEffect(() => {
    setIsLoadingMessages(true);
    const unsubscribe = subscribeToMessages(
      conversation.id,
      messageLimit,
      (newMsgs, more) => {
        setMessages(newMsgs);
        setHasMore(more);
        setIsLoadingMessages(false);
        setIsLoadingOlder(false);

        // Mark messages not sent by currentUser as delivered/read
        if (newMsgs.some((m) => m.senderId !== currentUser.uid && m.status === "sent")) {
          markMessagesAsDelivered(conversation.id, currentUser.uid);
        }
      },
      (err) => {
        console.error("Messages subscription error:", err);
        setIsLoadingMessages(false);
        setIsLoadingOlder(false);
      }
    );

    return () => unsubscribe();
  }, [conversation.id, messageLimit, currentUser.uid]);

  // Read receipts: Track messages actually viewed in viewport using IntersectionObserver
  const pendingReadSetRef = useRef<Set<string>>(new Set());
  const readFlushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushPendingReads = () => {
    if (pendingReadSetRef.current.size === 0) return;
    const ids = Array.from(pendingReadSetRef.current);
    pendingReadSetRef.current.clear();
    markSpecificMessagesAsRead(conversation.id, ids, currentUser.uid);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        let hasNewReads = false;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const msgId = entry.target.getAttribute("data-message-id");
            const senderId = entry.target.getAttribute("data-sender-id");
            const status = entry.target.getAttribute("data-status");

            if (msgId && senderId !== currentUser.uid && status !== "read") {
              pendingReadSetRef.current.add(msgId);
              hasNewReads = true;
            }
          }
        });

        if (hasNewReads) {
          if (readFlushTimeoutRef.current) clearTimeout(readFlushTimeoutRef.current);
          readFlushTimeoutRef.current = setTimeout(flushPendingReads, 500);
        }
      },
      {
        root: container,
        threshold: 0.5, // Message must be at least 50% in view to count as read
      }
    );

    // Observe unread message elements from other participants
    const unreadElements = container.querySelectorAll("[data-message-id]");
    unreadElements.forEach((el) => {
      const senderId = el.getAttribute("data-sender-id");
      const status = el.getAttribute("data-status");
      if (senderId !== currentUser.uid && status !== "read") {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
      if (readFlushTimeoutRef.current) {
        clearTimeout(readFlushTimeoutRef.current);
        flushPendingReads();
      }
    };
  }, [messages, currentUser.uid, conversation.id]);

  // Subscribe to Realtime presence if 1-to-1
  useEffect(() => {
    if (!otherUid || conversation.type !== "direct") return;
    const unsubPresence = subscribeToUserPresence(otherUid, (p) => setPresence(p));
    return () => unsubPresence();
  }, [otherUid, conversation.type]);

  // Subscribe to typing indicators
  useEffect(() => {
    const unsubTyping = subscribeToTyping(conversation.id, currentUser.uid, (list) => {
      setTypingList(list);
    });
    return () => unsubTyping();
  }, [conversation.id, currentUser.uid]);

  // Scroll container scroll listener to detect upward scroll for lazy loading
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Track if user is at the bottom
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;

    // Check if user scrolled near the top to load older messages
    if (container.scrollTop < 60 && hasMore && !isLoadingOlder && !isLoadingMessages) {
      prevScrollHeightRef.current = container.scrollHeight;
      setIsLoadingOlder(true);
      setMessageLimit((prev) => prev + 25);
    }
  };

  // Keep scroll position stable when older messages are prepended
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current > 0) {
      // Maintain exact relative offset so viewport doesn't jump
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop += heightDiff;
      prevScrollHeightRef.current = 0;
    } else if (isNearBottomRef.current) {
      // Auto-scroll to bottom on initial load or when receiving a message at bottom
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Send regular text message
  const handleSendMessage = async (text: string, replyTo?: ChatMessage) => {
    try {
      const payload: Parameters<typeof sendMessage>[1] = {
        conversationId: conversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        text,
        type: "text",
      };

      if (currentUser.avatarUrl) {
        payload.senderAvatar = currentUser.avatarUrl;
      }

      if (replyTo) {
        payload.replyTo = {
          messageId: replyTo.id,
          text: replyTo.text,
          senderName: replyTo.senderName,
        };
      }

      await sendMessage(conversation.id, payload);

      // If this is the Veyra AI companion conversation, trigger LLM generation
      if (conversation.type === "ai") {
        setIsAiResponding(true);
        try {
          const historyForAi: AiChatMessage[] = messages.slice(-10).map((m) => ({
            role: m.senderId === VEYRA_AI_PROFILE.uid ? "assistant" : "user",
            content: m.text,
            timestamp: m.createdAt,
          }));

          const aiResult = await sendPromptToVeyraAi(text, historyForAi);
          if (aiResult.success && aiResult.text) {
            await sendMessage(conversation.id, {
              conversationId: conversation.id,
              senderId: VEYRA_AI_PROFILE.uid,
              senderName: VEYRA_AI_PROFILE.displayName,
              senderAvatar: VEYRA_AI_PROFILE.avatarUrl,
              text: aiResult.text,
              type: "text",
            });
          } else {
            setActionErrorToast(
              aiResult.error || "Veyra AI could not generate a response. Please try again."
            );
            setTimeout(() => setActionErrorToast(null), 4000);
          }
        } catch (aiErr: any) {
          console.error("Veyra AI generation failed:", aiErr);
          setActionErrorToast("Failed to reach Veyra AI. Please try again.");
          setTimeout(() => setActionErrorToast(null), 4000);
        } finally {
          setIsAiResponding(false);
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Send photo with SD/HD metadata
  const handleSendImage = async (
    imageUrl: string,
    quality: "sd" | "hd",
    metadata?: ChatMessage["mediaMetadata"]
  ) => {
    try {
      await sendMessage(conversation.id, {
        conversationId: conversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatarUrl,
        text: "Photo",
        type: "image",
        mediaUrl: imageUrl,
        mediaQuality: quality,
        mediaMetadata: metadata,
      });
    } catch (err) {
      console.error("Failed to send image message:", err);
    }
  };

  // Send GIF
  const handleSendGif = async (gifUrl: string) => {
    try {
      await sendMessage(conversation.id, {
        conversationId: conversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatarUrl,
        text: "GIF",
        type: "gif",
        mediaUrl: gifUrl,
      });
    } catch (err) {
      console.error("Failed to send GIF message:", err);
    }
  };

  // Send Sticker
  const handleSendSticker = async (stickerUrlOrEmoji: string) => {
    try {
      const isUrl = stickerUrlOrEmoji.startsWith("http");
      await sendMessage(conversation.id, {
        conversationId: conversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatarUrl,
        text: isUrl ? "" : stickerUrlOrEmoji,
        mediaUrl: isUrl ? stickerUrlOrEmoji : undefined,
        type: "sticker",
      });
    } catch (err) {
      console.error("Failed to send sticker message:", err);
    }
  };

  // Edit Message (Allowed only within 2 days of message creation)
  const handleStartEdit = (msg: ChatMessage) => {
    const ageMs = Date.now() - msg.createdAt;
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    if (ageMs > TWO_DAYS_MS) {
      setActionErrorToast("Messages can only be edited within 2 days of sending.");
      setTimeout(() => setActionErrorToast(null), 3500);
      return;
    }
    setEditingMessage(msg);
    setEditText(msg.text);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      setEditError(null);
      await editMessage(conversation.id, editingMessage.id, editText.trim());
      setEditingMessage(null);
    } catch (err: any) {
      console.error("Failed to edit message:", err);
      setEditError(err.message || "Failed to edit message.");
    }
  };

  // Deletions
  const handleDeleteForEveryone = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (msg) {
      const ageMs = Date.now() - msg.createdAt;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      if (ageMs > ONE_DAY_MS) {
        setActionErrorToast("Messages can only be deleted for everyone within 24 hours.");
        setTimeout(() => setActionErrorToast(null), 3500);
        return;
      }
    }

    try {
      await deleteMessageForEveryone(conversation.id, msgId);
    } catch (err: any) {
      console.error("Failed to delete message for everyone:", err);
      setActionErrorToast(err.message || "Failed to delete message for everyone.");
      setTimeout(() => setActionErrorToast(null), 3500);
    }
  };

  const handleDeleteForMe = async (msgId: string) => {
    try {
      await deleteMessageForMe(conversation.id, msgId, currentUser.uid);
    } catch (err: any) {
      console.error("Failed to delete message for me:", err);
      setActionErrorToast(err.message || "Failed to delete message for you.");
      setTimeout(() => setActionErrorToast(null), 3500);
    }
  };

  // Date separator generator
  const getDateLabel = (currentDate: Date, prevDate?: Date) => {
    if (!prevDate) {
      return getRelativeDateString(currentDate);
    }
    const isSameDay =
      currentDate.getDate() === prevDate.getDate() &&
      currentDate.getMonth() === prevDate.getMonth() &&
      currentDate.getFullYear() === prevDate.getFullYear();

    if (!isSameDay) {
      return getRelativeDateString(currentDate);
    }
    return undefined;
  };

  const getRelativeDateString = (date: Date) => {
    const now = new Date();
    if (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    ) {
      return "TODAY";
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return "YESTERDAY";
    }
    return date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main Conversation Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--chat-bg)] relative">
        {/* Header */}
        <ConversationHeader
          conversation={conversation}
          currentUser={currentUser}
          presence={presence}
          typingList={typingList}
          messages={messages}
          isAiResponding={isAiResponding}
          onToggleDetails={() => setShowDetails(!showDetails)}
          onBackMobile={onBackMobile}
        />

        {/* Universal Chat Wallpaper Layered Container */}
        <UniversalChatWallpaper
          customWallpaperUrl={currentUser.chatWallpaper}
          isAiConversation={conversation.type === "ai"}
          className="flex-1"
        >
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth"
          >
            <div className="min-h-full flex flex-col justify-start">
            {/* Older messages loading skeleton indicator */}
            {isLoadingOlder && (
              <div className="flex items-center justify-center py-3 select-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-sm border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-500">
                  <span className="w-3.5 h-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  <span>Loading older messages...</span>
                </div>
              </div>
            )}

            {!hasMore && !isLoadingOlder && messages.length >= 25 && (
              <div className="flex justify-center py-3 select-none text-[11px] text-slate-400 font-medium">
                <span>Beginning of conversation</span>
              </div>
            )}

            {isLoadingMessages ? (
              <MessageListSkeleton />
            ) : messages.length > 0 ? (
              messages.map((msg, idx) => {
                const prevMsg = idx > 0 ? messages[idx - 1] : undefined;
                const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : undefined;

                const showDate = getDateLabel(
                  new Date(msg.createdAt),
                  prevMsg ? new Date(prevMsg.createdAt) : undefined
                );

                const isSameSenderAsPrev =
                  !showDate &&
                  prevMsg?.senderId === msg.senderId &&
                  msg.createdAt - prevMsg.createdAt < 5 * 60 * 1000;

                const isSameSenderAsNext =
                  nextMsg?.senderId === msg.senderId &&
                  nextMsg.createdAt - msg.createdAt < 5 * 60 * 1000 &&
                  !getDateLabel(new Date(nextMsg.createdAt), new Date(msg.createdAt));

                const isFirstInGroup = !isSameSenderAsPrev;
                const isLastInGroup = !isSameSenderAsNext;

                return (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    currentUser={currentUser}
                    showDateSeparator={showDate}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                    isGroup={conversation.type === "group"}
                    onReply={(m) => setReplyingTo(m)}
                    onForward={(m) => setForwardingMessage(m)}
                    onEdit={handleStartEdit}
                    onDeleteForEveryone={handleDeleteForEveryone}
                    onDeleteForMe={handleDeleteForMe}
                    onOpenImageViewer={(m) => setViewerMessage(m)}
                  />
                );
              })
            ) : conversation.type === "ai" ? (
              <VeyraAiWelcomeCard onSelectPrompt={(p) => handleSendMessage(p)} />
            ) : (
              <EmptyState
                icon="mark_chat_unread"
                title="Start the conversation."
                description="Send a message, sticker, or photo to break the ice!"
                className="my-auto"
              />
            )}
            {/* Veyra AI Thinking Indicator */}
            {isAiResponding && (
              <div className="flex items-center gap-2 p-2.5 px-3.5 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 w-fit text-xs shadow-xs animate-in fade-in slide-in-from-bottom-2">
                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                  <img
                    src="/assets/veyra_ai_logo.png"
                    alt="Veyra AI"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  Veyra is thinking...
                </span>
                <span className="flex gap-1 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]" />
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Action Error Toast */}
        {actionErrorToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span>{actionErrorToast}</span>
            <button
              onClick={() => setActionErrorToast(null)}
              className="hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Bar */}
        <MessageInputBar
            onSendMessage={handleSendMessage}
            onTyping={(isTyping) =>
              setTypingStatus(
                conversation.id,
                currentUser.uid,
                currentUser.username,
                currentUser.displayName,
                isTyping
              )
            }
            onOpenMediaModal={(file) => {
              setMediaFileToUpload(file || null);
              setComingSoonInfo(null);
              setIsMediaModalOpen(true);
            }}
            onOpenGifModal={() => setIsGifModalOpen(true)}
            onOpenStickerModal={() => setIsStickerModalOpen(true)}
            onSendGif={handleSendGif}
            onSendSticker={handleSendSticker}
            onComingSoon={(title, description, icon) => {
              setMediaFileToUpload(null);
              setComingSoonInfo({ title, description, icon });
              setIsMediaModalOpen(true);
            }}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            isAiConversation={conversation.type === "ai"}
          />
        </UniversalChatWallpaper>

        {/* Modals */}
        <MediaAttachmentModal
          isOpen={isMediaModalOpen}
          onClose={() => {
            setIsMediaModalOpen(false);
            setMediaFileToUpload(null);
            setComingSoonInfo(null);
          }}
          onSendImage={handleSendImage}
          initialFile={mediaFileToUpload}
          initialComingSoon={comingSoonInfo}
        />

        <GifPickerModal
          isOpen={isGifModalOpen}
          onClose={() => setIsGifModalOpen(false)}
          onSelectGif={handleSendGif}
        />

        <StickerPickerModal
          isOpen={isStickerModalOpen}
          onClose={() => setIsStickerModalOpen(false)}
          onSelectSticker={handleSendSticker}
        />

        {/* Forward Message Modal */}
        <ForwardMessageModal
          isOpen={!!forwardingMessage}
          message={forwardingMessage}
          currentUser={currentUser}
          onClose={() => setForwardingMessage(null)}
        />

        {/* Image Viewer Lightbox Modal */}
        <ImageViewerModal
          isOpen={!!viewerMessage}
          onClose={() => setViewerMessage(null)}
          message={viewerMessage}
        />

        {/* Edit Message Modal */}
        <Modal
          isOpen={!!editingMessage}
          onClose={() => {
            setEditingMessage(null);
            setEditError(null);
          }}
          title="Edit Message"
          maxWidth="sm"
        >
          <div className="space-y-4">
            {editError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
                {editError}
              </div>
            )}
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Edit your message..."
              autoFocus
            />
            <p className="text-[11px] text-slate-400">
              Note: Messages can only be edited within 2 days of sending.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingMessage(null);
                  setEditError(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      </div>

      {/* Details Panel (Toggleable) */}
      <DetailsPanel
        conversation={conversation}
        currentUser={currentUser}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onGroupDeletedOrLeft={onBackMobile}
      />
    </div>
  );
};
