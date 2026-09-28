"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";

import { Conversation, ChatMessage, UserProfile, UserPresence, TypingIndicator, GroupDetails } from "@/types";
import { subscribeToGroup } from "@/lib/firestore/groupService";
import { ConversationHeader } from "./ConversationHeader";
import { MessageItem } from "./MessageItem";
import { MessageInputBar } from "./MessageInputBar";
import { DetailsPanel } from "./DetailsPanel";
import { MediaAttachmentModal } from "./MediaAttachmentModal";
import { GifPickerModal } from "./GifPickerModal";
import { StickerPickerModal } from "./StickerPickerModal";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { ImageViewerModal } from "./media/ImageViewerModal";
import { CollageViewerModal } from "./media/CollageViewerModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageListSkeleton } from "@/components/ui/Skeleton";
import { VeyraAiWelcomeCard } from "@/components/ai/VeyraAiWelcomeCard";
import { UniversalChatWallpaper } from "./UniversalChatWallpaper";
import { WhatsAppForwardIcon } from "./WhatsAppForwardIcon";
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
  starMultipleMessages,
  deleteMultipleMessages,
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
  const [forwardingMessages, setForwardingMessages] = useState<ChatMessage[]>([]);
  const [viewerMessage, setViewerMessage] = useState<ChatMessage | null>(null);
  const [collageViewerMessage, setCollageViewerMessage] = useState<ChatMessage | null>(null);
  const [collageInitialIndex, setCollageInitialIndex] = useState(0);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [actionErrorToast, setActionErrorToast] = useState<string | null>(null);

  // Message Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [deleteStarredInSelection, setDeleteStarredInSelection] = useState(false);

  // Presence & Typing
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [typingList, setTypingList] = useState<TypingIndicator[]>([]);
  const [isAiResponding, setIsAiResponding] = useState(false);

  // Scroll containers and refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);
  const showDetailsRef = useRef<boolean>(false);
  showDetailsRef.current = showDetails;

  // In-chat Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // In-chat search matching messages (chronological order)
  const searchMatches = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return messages.filter(
      (m) =>
        m.text?.toLowerCase().includes(q) ||
        m.senderName?.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // Keep match index bounded when matches change
  useEffect(() => {
    if (searchMatches.length === 0) {
      setCurrentMatchIndex(0);
    } else if (currentMatchIndex >= searchMatches.length) {
      setCurrentMatchIndex(searchMatches.length - 1);
    }
  }, [searchMatches.length, currentMatchIndex]);

  // Scroll to current search match
  const scrollToMatch = (index: number) => {
    if (searchMatches.length === 0 || index < 0 || index >= searchMatches.length) return;
    const targetMatch = searchMatches[index];
    if (!targetMatch) return;
    const el = document.getElementById(`msg-${targetMatch.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToMatch(prevIdx);
  };

  // Selection mode entry and exit without page reload
  const handleOpenSelectionMode = () => {
    setIsSelectionMode(true);
    setSelectedMessageIds(new Set());
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("chat_selection", "true");
      window.history.pushState({ chatSelection: true }, "", url.toString());
    }
  };

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
    setShowDeleteSelectedConfirm(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("chat_selection")) {
        url.searchParams.delete("chat_selection");
        window.history.replaceState({ chatSelection: false }, "", url.toString());
      }
    }
  };

  const handleToggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  // History sync for Contact Info: /chat/info without full page reload
  const handleOpenDetails = () => {
    setShowDetails(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const searchParams = url.search;
      const stateObj = {
        ...(window.history.state || {}),
        __NA: true,
        panel: "info",
      };
      window.history.pushState(stateObj, "", `/chat/info${searchParams}`);
    }
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const searchParams = url.search;
      const stateObj = {
        ...(window.history.state || {}),
        __NA: true,
        panel: null,
      };
      // Cleanly replace URL back to /chat without triggering popstate or Next.js App Router route reload
      window.history.replaceState(stateObj, "", `/chat${searchParams}`);
    }
  };

  // Intercept back button popstate in CAPTURE phase (useCapture: true)
  // This intercepts back navigation and prevents Next.js App Router from detecting cross-route change and reloading!
  useEffect(() => {
    const handlePopStateCapture = (e: PopStateEvent) => {
      if (showDetailsRef.current) {
        // Intercept and stop propagation to prevent Next.js from reloading the page
        e.preventDefault();
        e.stopImmediatePropagation();
        setShowDetails(false);
        return;
      }

      if (!window.location.search.includes("chat_selection=true")) {
        setIsSelectionMode(false);
        setSelectedMessageIds(new Set());
        setShowDeleteSelectedConfirm(false);
      } else {
        setIsSelectionMode(true);
      }
    };

    window.addEventListener("popstate", handlePopStateCapture, true);
    return () => window.removeEventListener("popstate", handlePopStateCapture, true);
  }, []);

  // Check URL on load for chat_selection
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("chat_selection=true")) {
      setIsSelectionMode(true);
    }
  }, []);

  // Determine other user's UID for 1-to-1 presence
  const otherUid = conversation.participantIds.find((id) => id !== currentUser.uid);

  // Group details subscription to enforce group permissions (e.g. who can send messages)
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  useEffect(() => {
    if (conversation.type !== "group") {
      setGroupDetails(null);
      return;
    }
    const unsub = subscribeToGroup(conversation.id, (g) => {
      setGroupDetails(g);
    });
    return () => unsub();
  }, [conversation.id, conversation.type]);

  const currentGroupMembers = groupDetails?.members || groupDetails?.memberIds || [];
  const currentGroupAdmins = groupDetails?.admins || groupDetails?.adminIds || [];
  const isCurrentUserAdmin = conversation.type === "group" && currentGroupAdmins.includes(currentUser.uid);
  const isNoLongerMember =
    conversation.type === "group" &&
    ((groupDetails !== null && !currentGroupMembers.includes(currentUser.uid)) ||
      Boolean(conversation.leftParticipantIds?.includes(currentUser.uid)));
  const isOnlyAdminsCanSend =
    conversation.type === "group" &&
    !isNoLongerMember &&
    groupDetails?.settings?.whoCanSendMessages === "admins" &&
    !isCurrentUserAdmin;

  // Reset pagination and selection when conversation changes
  useEffect(() => {
    setMessageLimit(25);
    setHasMore(false);
    setIsLoadingOlder(false);
    isNearBottomRef.current = true;
    setIsSearchOpen(false);
    setSearchQuery("");
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
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

  // Mark conversation as read on initial open
  useEffect(() => {
    if (conversation?.id && currentUser?.uid) {
      markConversationAsRead(conversation.id, currentUser.uid);
    }
  }, [conversation?.id, currentUser?.uid]);

  // Read receipts: Track messages actually viewed in viewport using IntersectionObserver and bounds checking
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
    if (!container) return;

    const checkVisibleUnread = () => {
      const containerRect = container.getBoundingClientRect();
      let hasNewReads = false;
      const unreadElements = container.querySelectorAll("[data-message-id]");

      unreadElements.forEach((el) => {
        const senderId = el.getAttribute("data-sender-id");
        const status = el.getAttribute("data-status");
        const msgId = el.getAttribute("data-message-id");

        if (
          msgId &&
          senderId !== currentUser.uid &&
          status !== "read" &&
          !pendingReadSetRef.current.has(msgId)
        ) {
          const rect = el.getBoundingClientRect();
          const top = Math.max(rect.top, containerRect.top);
          const bottom = Math.min(rect.bottom, containerRect.bottom);
          const visibleHeight = Math.max(0, bottom - top);
          const msgHeight = rect.height;
          const containerHeight = containerRect.height || 500;

          // If a message is too large to fit entirely in the viewport,
          // it must still be marked as read as long as the user has viewed a significant part of it:
          const isVisible =
            visibleHeight > 0 &&
            (visibleHeight >= Math.min(msgHeight * 0.35, 80) ||
              (containerHeight > 0 && visibleHeight / containerHeight >= 0.2) ||
              (msgHeight > 0 && visibleHeight / msgHeight >= 0.35));

          if (isVisible) {
            pendingReadSetRef.current.add(msgId);
            hasNewReads = true;
          }
        }
      });

      if (hasNewReads) {
        if (readFlushTimeoutRef.current) clearTimeout(readFlushTimeoutRef.current);
        readFlushTimeoutRef.current = setTimeout(flushPendingReads, 350);
      }
    };

    // Run direct visible check slightly after layout settles
    const initialCheckTimer = setTimeout(checkVisibleUnread, 150);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          let hasNewReads = false;
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const msgHeight = entry.boundingClientRect.height;
              const containerHeight = container.clientHeight || 500;
              const visibleHeight = entry.intersectionRect.height;

              const isVisible =
                visibleHeight > 0 &&
                (visibleHeight >= Math.min(msgHeight * 0.35, 80) ||
                  (containerHeight > 0 && visibleHeight / containerHeight >= 0.2) ||
                  entry.intersectionRatio >= 0.35);

              if (isVisible) {
                const msgId = entry.target.getAttribute("data-message-id");
                const senderId = entry.target.getAttribute("data-sender-id");
                const status = entry.target.getAttribute("data-status");

                if (
                  msgId &&
                  senderId !== currentUser.uid &&
                  status !== "read" &&
                  !pendingReadSetRef.current.has(msgId)
                ) {
                  pendingReadSetRef.current.add(msgId);
                  hasNewReads = true;
                  observer?.unobserve(entry.target);
                }
              }
            }
          });

          if (hasNewReads) {
            if (readFlushTimeoutRef.current) clearTimeout(readFlushTimeoutRef.current);
            readFlushTimeoutRef.current = setTimeout(flushPendingReads, 350);
          }
        },
        {
          root: container,
          threshold: [0, 0.1, 0.25, 0.5],
        }
      );

      // Observe unread message elements from other participants
      const unreadElements = container.querySelectorAll("[data-message-id]");
      unreadElements.forEach((el) => {
        const senderId = el.getAttribute("data-sender-id");
        const status = el.getAttribute("data-status");
        if (senderId !== currentUser.uid && status !== "read") {
          observer?.observe(el);
        }
      });
    }

    container.addEventListener("scroll", checkVisibleUnread, { passive: true });

    return () => {
      clearTimeout(initialCheckTimer);
      container.removeEventListener("scroll", checkVisibleUnread);
      if (observer) observer.disconnect();
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

  // Helper to reliably scroll the messages container to the bottom
  const scrollToBottom = React.useCallback((instant = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: instant ? "auto" : "smooth",
        block: "end",
      });
    }
  }, []);

  // Keep scroll position stable when older messages are prepended, or scroll to bottom on new messages
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current > 0) {
      // Maintain exact relative offset so viewport doesn't jump
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop += heightDiff;
      prevScrollHeightRef.current = 0;
    } else if (isNearBottomRef.current) {
      // Auto-scroll to bottom immediately
      scrollToBottom(true);

      // Perform delayed passes to account for images, voice notes, stickers, and layout settling
      const t1 = setTimeout(() => scrollToBottom(true), 60);
      const t2 = setTimeout(() => scrollToBottom(true), 180);
      const t3 = setTimeout(() => scrollToBottom(true), 380);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [messages, scrollToBottom]);

  // Observe height changes of the message list as images, stickers, and fonts finish rendering
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const contentEl = container.firstElementChild as HTMLElement;
    if (!contentEl || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        scrollToBottom(true);
      }
    });

    ro.observe(contentEl);
    return () => ro.disconnect();
  }, [scrollToBottom]);


  // Send regular text message
  const handleSendMessage = async (text: string, replyTo?: ChatMessage) => {
    if (isNoLongerMember || isOnlyAdminsCanSend) return;
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
  // Send photo with SD/HD metadata, optional caption, and multi-image support
  const handleSendImage = async (
    imageUrl: string,
    quality: "sd" | "hd",
    metadata?: ChatMessage["mediaMetadata"],
    caption?: string,
    additionalUrls?: string[]
  ) => {
    if (isNoLongerMember || isOnlyAdminsCanSend) return;
    try {
      const allUrls = additionalUrls && additionalUrls.length > 0 ? [imageUrl, ...additionalUrls] : [imageUrl];
      await sendMessage(conversation.id, {
        conversationId: conversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatarUrl,
        text: caption || (allUrls.length > 1 ? `${allUrls.length} Photos` : "Photo"),
        type: "image",
        mediaUrl: imageUrl,
        mediaUrls: allUrls,
        mediaQuality: quality,
        mediaMetadata: metadata,
      });
    } catch (err) {
      console.error("Failed to send image message:", err);
    }
  };

  // Send GIF
  const handleSendGif = async (gifUrl: string) => {
    if (isNoLongerMember || isOnlyAdminsCanSend) return;
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
    if (isNoLongerMember || isOnlyAdminsCanSend) return;
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

  const clearedAt = conversation.clearedAt?.[currentUser.uid] || 0;
  const visibleMessages = React.useMemo(() => {
    return messages.filter((m) => {
      if (m.deletedForUsers?.includes(currentUser.uid)) return false;
      if (clearedAt > 0 && m.createdAt <= clearedAt) return false;
      return true;
    });
  }, [messages, currentUser.uid, clearedAt]);

  const selectedMessagesList = React.useMemo(() => {
    return visibleMessages.filter((m) => selectedMessageIds.has(m.id));
  }, [visibleMessages, selectedMessageIds]);

  const hasNonImageSelected = React.useMemo(() => {
    return selectedMessagesList.some((m) => m.type !== "image" || !m.mediaUrl);
  }, [selectedMessagesList]);

  const isDownloadDisabled = selectedMessagesList.length === 0 || hasNonImageSelected;

  const allSelectedAreStarred =
    selectedMessagesList.length > 0 &&
    selectedMessagesList.every((m) => m.starredBy?.includes(currentUser.uid));

  const handleStarSelected = async () => {
    if (selectedMessageIds.size === 0) return;
    const ids = Array.from(selectedMessageIds);
    await starMultipleMessages(conversation.id, ids, currentUser.uid, !allSelectedAreStarred);
    handleExitSelectionMode();
  };

  const handleDeleteSelectedMessages = () => {
    if (selectedMessageIds.size === 0) return;
    setDeleteStarredInSelection(false);
    setShowDeleteSelectedConfirm(true);
  };

  const handleConfirmDeleteSelected = async () => {
    if (selectedMessageIds.size === 0) return;
    let targetIds = Array.from(selectedMessageIds);
    if (!deleteStarredInSelection) {
      targetIds = selectedMessagesList
        .filter((m) => !m.starredBy?.includes(currentUser.uid))
        .map((m) => m.id);
    }
    setShowDeleteSelectedConfirm(false);
    handleExitSelectionMode();
    if (targetIds.length > 0) {
      await deleteMultipleMessages(conversation.id, targetIds);
    }
  };

  const handleForwardSelected = () => {
    if (selectedMessagesList.length === 0) return;
    setForwardingMessages(selectedMessagesList);
    handleExitSelectionMode();
  };

  const handleDownloadSelected = async () => {
    if (isDownloadDisabled) return;
    for (const msg of selectedMessagesList) {
      if (msg.mediaUrl) {
        try {
          const response = await fetch(msg.mediaUrl);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = msg.mediaMetadata?.fileName || `image-${msg.id}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch {
          const a = document.createElement("a");
          a.href = msg.mediaUrl;
          a.target = "_blank";
          a.download = msg.mediaMetadata?.fileName || `image-${msg.id}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    }
    handleExitSelectionMode();
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
          onOpenSelectionMode={handleOpenSelectionMode}
          onToggleDetails={() => {
            if (showDetails) {
              handleCloseDetails();
            } else {
              handleOpenDetails();
            }
          }}
          onBackMobile={onBackMobile}
          isSearchOpen={isSearchOpen}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          onOpenSearch={() => {
            setIsSearchOpen(true);
          }}
          onCloseSearch={() => {
            setIsSearchOpen(false);
            setSearchQuery("");
          }}
          matchCount={searchMatches.length}
          currentMatchIndex={currentMatchIndex}
          onPrevMatch={handlePrevMatch}
          onNextMatch={handleNextMatch}
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
            className="flex-1 overflow-y-auto p-4 space-y-1"
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

            {(() => {
              if (isLoadingMessages) {
                return <MessageListSkeleton />;
              }

              if (visibleMessages.length > 0) {
                return visibleMessages.map((msg, idx) => {
                  const prevMsg = idx > 0 ? visibleMessages[idx - 1] : undefined;
                  const nextMsg = idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : undefined;

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

                  const isMatch = Boolean(searchQuery.trim() && searchMatches.some((m) => m.id === msg.id));
                  const isCurrent = Boolean(
                    searchMatches.length > 0 &&
                    searchMatches[currentMatchIndex]?.id === msg.id
                  );

                  return (
                    <MessageItem
                      key={msg.id}
                      message={msg}
                      currentUser={currentUser}
                      showDateSeparator={showDate}
                      isFirstInGroup={isFirstInGroup}
                      isLastInGroup={isLastInGroup}
                      isGroup={conversation.type === "group"}
                      isSearchMatch={isMatch}
                      isCurrentSearchMatch={isCurrent}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedMessageIds.has(msg.id)}
                      onToggleSelect={() => handleToggleSelectMessage(msg.id)}
                      onReply={(m) => setReplyingTo(m)}
                      onForward={(m) => setForwardingMessage(m)}
                      onEdit={handleStartEdit}
                      onDeleteForEveryone={handleDeleteForEveryone}
                      onDeleteForMe={handleDeleteForMe}
                      onOpenImageViewer={(m, idx) => {
                        if (m.mediaUrls && m.mediaUrls.length > 1) {
                          setCollageViewerMessage(m);
                          setCollageInitialIndex(idx || 0);
                        } else {
                          setViewerMessage(m);
                        }
                      }}
                    />
                  );
                });
              }

              if (conversation.type === "ai") {
                return <VeyraAiWelcomeCard onSelectPrompt={(p) => handleSendMessage(p)} />;
              }

              return (
                <EmptyState
                  icon="mark_chat_unread"
                  title="Start the conversation."
                  description="Send a message, sticker, or photo to break the ice!"
                  className="my-auto"
                />
              );
            })()}
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

        {/* Input Bar / Selection Bottom Bar */}
        {isSelectionMode ? (
          <div className="h-16 px-4 flex items-center justify-between bg-[#F0F2F5] dark:bg-[#1E293B] border-t border-slate-200/80 dark:border-slate-800 select-none z-20">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExitSelectionMode}
                className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Close selection"
                aria-label="Close selection"
              >
                <Icon name="close" size="md" />
              </button>
              <span className="text-[15px] font-medium text-slate-800 dark:text-slate-200">
                {selectedMessageIds.size} selected
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Star / Unstar */}
              <button
                type="button"
                onClick={handleStarSelected}
                disabled={selectedMessageIds.size === 0}
                className="p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title={allSelectedAreStarred ? "Unstar" : "Star"}
                aria-label="Star"
              >
                <Icon
                  name="star"
                  size="md"
                  fill={allSelectedAreStarred}
                  className={allSelectedAreStarred ? "text-amber-500 fill-amber-500" : ""}
                />
              </button>

              {/* Delete selected */}
              <button
                type="button"
                onClick={handleDeleteSelectedMessages}
                disabled={selectedMessageIds.size === 0}
                className="p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Delete"
                aria-label="Delete"
              >
                <Icon name="delete" size="md" />
              </button>

              {/* Forward */}
              <button
                type="button"
                onClick={handleForwardSelected}
                disabled={selectedMessageIds.size === 0}
                className="p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Forward"
                aria-label="Forward"
              >
                <WhatsAppForwardIcon className="w-5 h-5" />
              </button>

              {/* Download */}
              <button
                type="button"
                onClick={handleDownloadSelected}
                disabled={isDownloadDisabled}
                className="p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title={
                  isDownloadDisabled && selectedMessagesList.length > 0
                    ? "Download only available for photos"
                    : "Download"
                }
                aria-label="Download"
              >
                <Icon name="download" size="md" />
              </button>
            </div>
          </div>
        ) : isNoLongerMember ? (
          <div className="h-16 px-4 flex items-center justify-center gap-2 bg-[#F0F2F5] dark:bg-[#1E293B] border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 select-none">
            <span>You are no longer a member</span>
          </div>
        ) : isOnlyAdminsCanSend ? (
          <div className="h-16 px-4 flex items-center justify-center gap-2 bg-[#F0F2F5] dark:bg-[#1E293B] border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 select-none">
            <Icon name="lock" size="xs" />
            <span>Only admins can send messages to this group</span>
          </div>
        ) : (
          <MessageInputBar
            onSendMessage={handleSendMessage}
            onTyping={(isTyping) => {
              if (isNoLongerMember) return;
              setTypingStatus(
                conversation.id,
                currentUser.uid,
                currentUser.username,
                currentUser.displayName,
                isTyping
              );
            }}
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
        )}
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
          isOpen={!!forwardingMessage || forwardingMessages.length > 0}
          message={forwardingMessage}
          messages={forwardingMessages}
          currentUser={currentUser}
          onClose={() => {
            setForwardingMessage(null);
            setForwardingMessages([]);
          }}
        />

        {/* Confirmation Modal: Delete Selected Messages */}
        <Modal
          isOpen={showDeleteSelectedConfirm}
          onClose={() => setShowDeleteSelectedConfirm(false)}
          title={
            selectedMessageIds.size === 1
              ? "Delete message?"
              : `Delete ${selectedMessageIds.size} messages?`
          }
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedMessageIds.size === 1
                ? "Are you sure you want to permanently delete this message?"
                : `Are you sure you want to permanently delete these ${selectedMessageIds.size} messages?`}
            </p>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteStarredInSelection}
                onChange={(e) => setDeleteStarredInSelection(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Also delete starred messages
              </span>
            </label>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteSelectedConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDeleteSelected}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>

        {/* Image Viewer Lightbox Modal matching Reference Image 4 */}
        <ImageViewerModal
          isOpen={!!viewerMessage}
          onClose={() => setViewerMessage(null)}
          message={viewerMessage}
          allMediaMessages={visibleMessages}
          currentUser={currentUser}
          conversationId={conversation.id}
          onReply={(m) => setReplyingTo(m)}
          onForward={(m) => setForwardingMessage(m)}
          onDeleteForMe={handleDeleteForMe}
        />

        {/* Collage Viewer Lightbox Modal for multiple photos (<=49 images) */}
        <CollageViewerModal
          isOpen={!!collageViewerMessage}
          onClose={() => setCollageViewerMessage(null)}
          message={collageViewerMessage}
          initialIndex={collageInitialIndex}
          currentUser={currentUser}
          onReply={(m) => setReplyingTo(m)}
          onForward={(m) => setForwardingMessage(m)}
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
        onClose={handleCloseDetails}
        onGroupDeletedOrLeft={onBackMobile}
        messages={messages}
        onOpenImageViewer={(m) => {
          if (m.mediaUrls && m.mediaUrls.length > 1) {
            setCollageViewerMessage(m);
            setCollageInitialIndex(0);
          } else {
            setViewerMessage(m);
          }
        }}
      />
    </div>
  );
};
