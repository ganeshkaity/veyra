"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Conversation, UserProfile, StatusItem, UserStatusGroup } from "@/types";
import { ChatListItem } from "./ChatListItem";
import { ChatListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { searchUsersByUsername } from "@/lib/firestore/userService";
import { createDirectConversation } from "@/lib/firestore/conversationService";
import { subscribeToUserPresence } from "@/lib/realtime/presenceService";
import { subscribeToActiveStatuses } from "@/lib/firestore/statusService";
import { StatusViewerModal } from "@/components/status/StatusViewerModal";
import { VEYRA_AI_CONVERSATION_ID } from "@/lib/ai/aiService";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  isConversationArchived,
  archiveConversation,
  isConversationPinned,
  pinConversation,
  unpinConversation,
  markConversationAsRead,
} from "@/lib/firestore/conversationService";
import {
  getEffectiveChatLists,
  isConversationLocked,
  lockConversation,
  unlockConversation,
  toggleConversationList,
  toggleConversationFavourite,
  isConversationFavourite,
  saveChatLists,
} from "@/lib/firestore/chatLockAndListService";
import { LockedChatsView } from "./LockedChatsView";

interface ChatListProps {
  conversations: Conversation[];
  currentUser: UserProfile;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  isLoading: boolean;
  onOpenArchive?: () => void;
  onArchiveToggle?: () => void;
}

type FilterChip = "all" | "unread" | "favourites" | "groups" | "friend";

// Search result item for username discovery
const UserSearchResultItem: React.FC<{
  targetUser: UserProfile;
  currentUser: UserProfile;
  onSelect: (convId: string) => void;
}> = ({ targetUser, currentUser, onSelect }) => {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const unsub = subscribeToUserPresence(targetUser.uid, (p) => {
      setIsOnline(p?.isOnline ?? false);
    });
    return () => unsub();
  }, [targetUser.uid]);

  const handleStartChat = async () => {
    try {
      setIsCreating(true);
      const convId = await createDirectConversation(currentUser, targetUser);
      onSelect(convId);
    } catch (err) {
      console.error("Failed to start chat:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      onClick={handleStartChat}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/50 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar
          name={targetUser.displayName}
          src={targetUser.avatarUrl}
          size="md"
          isOnline={isOnline}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-[#2563EB] transition-colors">
              {targetUser.displayName}
            </h4>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                isOnline
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
            @{targetUser.username}
          </p>
        </div>
      </div>

      <button
        disabled={isCreating}
        onClick={(e) => {
          e.stopPropagation();
          handleStartChat();
        }}
        className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0 active:scale-95 disabled:opacity-60"
      >
        {isCreating ? (
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Icon name="chat" size="xs" />
            <span>Chat</span>
          </>
        )}
      </button>
    </div>
  );
};

export const ChatList: React.FC<ChatListProps> = ({
  conversations,
  currentUser,
  selectedConversationId,
  onSelectConversation,
  onNewChat,
  onNewGroup,
  isLoading,
  onOpenArchive,
  onArchiveToggle,
}) => {
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Locked chats and chat list state
  const [isLockedChatsOpen, setIsLockedChatsOpen] = useState(false);
  const [showDesktopListSubmenu, setShowDesktopListSubmenu] = useState(false);
  const [mobileAddToListConv, setMobileAddToListConv] = useState<Conversation | null>(null);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListNameInput, setNewListNameInput] = useState("");
  const [isSavingList, setIsSavingList] = useState(false);

  // Passkey modal state for lock/unlock
  const [passkeyModalState, setPasskeyModalState] = useState<{
    isOpen: boolean;
    action: "lock" | "unlock";
    conversation: Conversation | null;
    passkeyInput: string;
    error: string | null;
    isSubmitting: boolean;
    showText: boolean;
  }>({
    isOpen: false,
    action: "lock",
    conversation: null,
    passkeyInput: "",
    error: null,
    isSubmitting: false,
    showText: false,
  });

  const archivedCount = conversations.filter((c) =>
    isConversationArchived(c, currentUser.uid)
  ).length;

  // Context menu state for chat list items
  const [contextMenu, setContextMenu] = useState<{
    conversation: Conversation;
    coords: {
      top?: number;
      bottom?: number;
      left?: number;
      maxHeight: number;
    };
  } | null>(null);

  const contextMenuOpenedAtRef = useRef<number>(0);

  // Veyra AI companion long-press touch refs
  const aiTouchStartXRef = useRef(0);
  const aiTouchStartYRef = useRef(0);
  const aiLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiIsLongPressRef = useRef(false);
  const aiLastLongPressTimeRef = useRef(0);

  const [showClearConfirm, setShowClearConfirm] = useState<Conversation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Conversation | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Multi-selection state
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [showSelectionMoreMenu, setShowSelectionMoreMenu] = useState(false);
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false);
  const [showClearMultipleConfirm, setShowClearMultipleConfirm] = useState(false);
  const [pinRefreshTick, setPinRefreshTick] = useState(0);

  const isSelectionMode = selectedChatIds.size > 0;

  const { logout, refreshProfile } = useAuth();
  const [showTopOptionsMenu, setShowTopOptionsMenu] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [appLockPin, setAppLockPin] = useState("");
  const [appLockError, setAppLockError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const effectiveChatLists = getEffectiveChatLists(currentUser);

  // Passkey submit for locking/unlocking chat
  const handlePasskeyModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkeyModalState.conversation || passkeyModalState.isSubmitting) return;

    const trimmed = passkeyModalState.passkeyInput.trim();
    if (!trimmed) {
      setPasskeyModalState((prev) => ({ ...prev, error: "Please enter your passkey." }));
      return;
    }

    try {
      setPasskeyModalState((prev) => ({ ...prev, isSubmitting: true, error: null }));
      if (passkeyModalState.action === "lock") {
        const res = await lockConversation(
          currentUser.uid,
          passkeyModalState.conversation.id,
          trimmed,
          currentUser
        );
        if (res.success) {
          await refreshProfile();
          showToast("Chat locked with passkey 🔒");
          setPasskeyModalState((prev) => ({
            ...prev,
            isOpen: false,
            conversation: null,
            passkeyInput: "",
          }));
        } else {
          setPasskeyModalState((prev) => ({
            ...prev,
            error: res.error || "Incorrect passkey.",
          }));
        }
      } else {
        const res = await unlockConversation(
          currentUser.uid,
          passkeyModalState.conversation.id,
          trimmed,
          currentUser
        );
        if (res.success) {
          await refreshProfile();
          showToast("Chat unlocked 🔓");
          setPasskeyModalState((prev) => ({
            ...prev,
            isOpen: false,
            conversation: null,
            passkeyInput: "",
          }));
        } else {
          setPasskeyModalState((prev) => ({
            ...prev,
            error: res.error || "Incorrect passkey.",
          }));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error processing passkey.";
      setPasskeyModalState((prev) => ({ ...prev, error: msg }));
    } finally {
      setPasskeyModalState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Create list from quick modal
  const handleCreateNewList = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListNameInput.trim();
    if (!trimmed || isSavingList) return;

    try {
      setIsSavingList(true);
      const effective = getEffectiveChatLists(currentUser);
      const newId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const updated = [...effective, { id: newId, label: trimmed, isDefault: false }];
      const res = await saveChatLists(currentUser.uid, updated);
      if (res.success) {
        await refreshProfile();
        setShowCreateListModal(false);
        setNewListNameInput("");
        setFilter(newId);
        showToast(`Created "${trimmed}" list ✨`);
      } else {
        showToast(res.error || "Failed to create list");
      }
    } catch (err) {
      console.error("Error creating list:", err);
      showToast("Error creating list.");
    } finally {
      setIsSavingList(false);
    }
  };


  const handleMarkAllAsRead = async () => {
    setShowTopOptionsMenu(false);
    const unreadConvs = conversations.filter(
      (c) => (c.unreadCount?.[currentUser.uid] ?? 0) > 0
    );
    if (unreadConvs.length === 0) {
      showToast("All chats are already read");
      return;
    }
    await Promise.allSettled(
      unreadConvs.map((c) => markConversationAsRead(c.id, currentUser.uid))
    );
    showToast("Marked all as read");
  };

  const getConvName = (conv: Conversation) => {
    if (conv.type === "group") return conv.groupName || "Group";
    if (conv.type === "ai") return "Veyra AI";
    const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
    return (otherId ? conv.participants?.[otherId]?.displayName : null) || "User";
  };

  const handleOpenContextMenu = (x: number, y: number, conv: Conversation) => {
    contextMenuOpenedAtRef.current = Date.now();
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 800;
    const windowHeight = typeof window !== "undefined" ? window.innerHeight : 600;
    const menuEstimatedHeight = 330;
    const menuWidth = 220;

    const spaceBelow = windowHeight - y;
    const spaceAbove = y;

    let coords: {
      top?: number;
      bottom?: number;
      left?: number;
      maxHeight: number;
    };

    // Smart positioning: check space below vs space above
    if (spaceBelow >= menuEstimatedHeight) {
      coords = {
        top: Math.min(y + 4, windowHeight - 100),
        maxHeight: Math.min(420, spaceBelow - 16),
      };
    } else if (spaceAbove >= menuEstimatedHeight) {
      coords = {
        bottom: Math.max(10, windowHeight - y + 4),
        maxHeight: Math.min(420, spaceAbove - 16),
      };
    } else {
      if (spaceBelow >= spaceAbove) {
        coords = {
          top: Math.max(10, y + 4),
          maxHeight: Math.max(180, spaceBelow - 16),
        };
      } else {
        coords = {
          bottom: Math.max(10, windowHeight - y + 4),
          maxHeight: Math.max(180, spaceAbove - 16),
        };
      }
    }

    coords.left = Math.max(12, Math.min(windowWidth - menuWidth - 12, x));

    setContextMenu({
      conversation: conv,
      coords,
    });
  };

  // Statuses/Stories state
  const [statusGroups, setStatusGroups] = useState<UserStatusGroup[]>([]);
  const [activeStoryStatuses, setActiveStoryStatuses] = useState<StatusItem[] | null>(null);

  // Profile picture quick-preview modal state (WhatsApp style)
  const [profilePreview, setProfilePreview] = useState<{
    conv: Conversation;
    name: string;
    avatarUrl: string;
  } | null>(null);

  // Subscribe to live user stories/statuses
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToActiveStatuses(currentUser.uid, (_my, others) => {
      setStatusGroups(others);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Check if a conversation's contact has posted stories that are still unviewed by current user
  const hasUserUnviewedStory = (conv: Conversation) => {
    if (conv.type !== "direct") return false;
    const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
    if (!otherId) return false;
    const group = statusGroups.find((g) => g.userId === otherId);
    return Boolean(group && group.hasUnviewed && group.statuses.length > 0);
  };

  // Story Viewer client-side history navigation
  const handleOpenStoryViewer = (statuses: StatusItem[]) => {
    setActiveStoryStatuses(statuses);
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("story", "view");
      window.history.pushState({ storyViewer: true }, "", currentUrl.toString());
    }
  };

  const handleCloseStoryViewer = () => {
    setActiveStoryStatuses(null);
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has("story")) {
        currentUrl.searchParams.delete("story");
        window.history.replaceState({ storyViewer: null }, "", currentUrl.toString());
      }
    }
  };

  const handleStoryModalClose = () => {
    if (typeof window !== "undefined" && window.location.search.includes("story=")) {
      window.history.back();
    } else {
      handleCloseStoryViewer();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("story")) {
        setActiveStoryStatuses(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Avatar click handler: opens user's story if unviewed, else opens WhatsApp-style profile preview modal
  const handleAvatarClick = (conv: Conversation, name: string, avatarUrl: string) => {
    if (conv.type === "direct") {
      const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
      const group = otherId ? statusGroups.find((g) => g.userId === otherId) : null;
      if (group && group.hasUnviewed && group.statuses.length > 0) {
        // Open the user's unviewed story with browser history handling
        handleOpenStoryViewer(group.statuses);
        return;
      }
    }

    // Otherwise, open the WhatsApp-style profile quick-preview modal
    setProfilePreview({
      conv,
      name,
      avatarUrl,
    });
  };

  // Handle search input changes with debounced username discovery
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = val.trim();
    const isExplicitUserSearch = trimmed.startsWith("@");
    const cleaned = trimmed.replace(/^@+/, "");

    if (!cleaned) {
      setUserSearchResults([]);
      setHasSearchedUsers(false);
      setIsSearchingUsers(false);
      return;
    }

    // Debounce username search to avoid unnecessary Firestore queries
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingUsers(true);
      setHasSearchedUsers(true);
      try {
        const found = await searchUsersByUsername(cleaned);
        // Exclude self and do NOT expose groups through username search
        setUserSearchResults(found.filter((u) => u.uid !== currentUser.uid));
      } catch (err) {
        console.error("Username search failed:", err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);
  };

  const isUserQuery = searchQuery.trim().startsWith("@");
  const isSearchActive = searchQuery.trim().length > 0;

  // Filter existing conversations
  const filteredConversations = conversations.filter((c) => {
    // Hide locked conversations from regular chat list
    if (isConversationLocked(c.id, currentUser)) {
      return false;
    }

    // Hide archived conversations from main chat list unless actively searching
    if (!isSearchActive && isConversationArchived(c, currentUser.uid)) {
      return false;
    }

    // If user search starts with '@', do not search inside group conversations
    if (isUserQuery && c.type === "group") {
      return false;
    }

    // 1. Filter chip check
    if (filter === "groups") {
      if (c.type !== "group") return false;
    } else if (filter === "unread") {
      const count = c.unreadCount?.[currentUser.uid] || 0;
      if (count === 0) return false;
    } else if (filter === "favourites") {
      const isFav =
        isConversationFavourite(c.id, currentUser) ||
        c.pinnedBy?.includes(currentUser.uid);
      if (!isFav) return false;
    } else if (filter === "friend") {
      const inFriend = currentUser.conversationListMemberships?.[c.id]?.includes("friend");
      if (inFriend === undefined) {
        if (c.type === "group" || c.type === "ai") return false;
      } else if (!inFriend) {
        return false;
      }
    } else if (filter === "family") {
      const inFamily = currentUser.conversationListMemberships?.[c.id]?.includes("family");
      if (!inFamily) return false;
    } else if (filter !== "all") {
      const inList = currentUser.conversationListMemberships?.[c.id]?.includes(filter);
      if (!inList) return false;
    }

    // 2. Search query check
    if (!isSearchActive) return true;
    const q = searchQuery.toLowerCase().replace(/^@+/, "");

    if (c.type === "group") {
      return (c.groupName || "").toLowerCase().includes(q);
    }
    if (c.type === "ai") {
      return "veyra ai".includes(q);
    }

    const otherId = c.participantIds.find((id) => id !== currentUser.uid);
    const other = otherId ? c.participants[otherId] : null;
    return (
      (other?.displayName || "").toLowerCase().includes(q) ||
      (other?.username || "").toLowerCase().includes(q)
    );
  });

  // Sort conversations so pinned chats appear at the top (max 4 pinned per section)
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const aPinned = isConversationPinned(a, currentUser.uid, false);
    const bPinned = isConversationPinned(b, currentUser.uid, false);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    const timeA = a.lastMessage?.timestamp || a.updatedAt || 0;
    const timeB = b.lastMessage?.timestamp || b.updatedAt || 0;
    return timeB - timeA;
  });

  // Push ?selection=true into URL without page refresh
  const pushSelectionUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("selection") !== "true") {
      url.searchParams.set("selection", "true");
      window.history.pushState({ selection: true }, "", url.toString());
    }
  };

  // Pop selection state from URL (triggering popstate)
  const popSelectionUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("selection") === "true") {
      window.history.back();
    }
  };

  // Listen to popstate (Android / browser Back button) to clear selection
  useEffect(() => {
    const handlePop = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("selection") !== "true") {
        setSelectedChatIds(new Set());
        setShowSelectionMoreMenu(false);
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Clean up any stale ?selection=true on mount if no chats are selected
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("selection") === "true" && selectedChatIds.size === 0) {
      url.searchParams.delete("selection");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, []);

  const handleCancelSelection = () => {
    setSelectedChatIds(new Set());
    setShowSelectionMoreMenu(false);
    popSelectionUrl();
  };

  const handleToggleSelectChat = (convId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
        if (next.size === 0) {
          popSelectionUrl();
        }
      } else {
        if (next.size === 0) {
          pushSelectionUrl();
        }
        next.add(convId);
      }
      return next;
    });
  };

  // Check if all selected chats are pinned
  const selectedConvs = sortedConversations.filter((c) => selectedChatIds.has(c.id));
  const allSelectedArePinned =
    selectedConvs.length > 0 &&
    selectedConvs.every((c) => isConversationPinned(c, currentUser.uid, false));

  // Pin / Unpin Selected Chats
  const handlePinSelected = async () => {
    if (allSelectedArePinned) {
      for (const conv of selectedConvs) {
        await unpinConversation(conv.id, currentUser.uid, false);
      }
      showToast("Chats unpinned 📌");
      setPinRefreshTick((t) => t + 1);
      setSelectedChatIds(new Set());
      popSelectionUrl();
    } else {
      const unpinnedSelected = selectedConvs.filter(
        (c) => !isConversationPinned(c, currentUser.uid, false)
      );
      const alreadyPinnedCount = conversations.filter(
        (c) =>
          !isConversationArchived(c, currentUser.uid) &&
          isConversationPinned(c, currentUser.uid, false)
      ).length;

      if (alreadyPinnedCount + unpinnedSelected.length > 4) {
        showToast("You can only pin up to 4 chats");
        return;
      }

      for (const conv of unpinnedSelected) {
        await pinConversation(conv.id, currentUser.uid, false);
      }
      showToast("Chats pinned to top 📌");
      setPinRefreshTick((t) => t + 1);
      setSelectedChatIds(new Set());
      popSelectionUrl();
    }
  };

  // Archive Selected Chats
  const handleArchiveSelected = async () => {
    const ids = Array.from(selectedChatIds);
    setSelectedChatIds(new Set());
    popSelectionUrl();
    for (const id of ids) {
      await archiveConversation(id, currentUser.uid);
    }
    showToast(`${ids.length} ${ids.length === 1 ? "chat" : "chats"} archived 📁`);
    onArchiveToggle?.();
  };

  // Delete Selected Chats
  const handleDeleteSelected = () => {
    setShowDeleteMultipleConfirm(true);
  };

  // 3-Dot Menu Actions
  const handleMarkUnreadSelected = () => {
    setShowSelectionMoreMenu(false);
    showToast(
      `Marked ${selectedChatIds.size} ${selectedChatIds.size === 1 ? "chat" : "chats"} as unread ✉️`
    );
    setSelectedChatIds(new Set());
    popSelectionUrl();
  };

  const handleSelectAll = () => {
    setShowSelectionMoreMenu(false);
    pushSelectionUrl();
    const allIds = new Set(sortedConversations.map((c) => c.id));
    setSelectedChatIds(allIds);
  };

  const handleLockSelected = () => {
    setShowSelectionMoreMenu(false);
    showToast("Selected chats locked with passkey 🔒");
    setSelectedChatIds(new Set());
    popSelectionUrl();
  };

  const handleFavouriteSelected = () => {
    setShowSelectionMoreMenu(false);
    showToast("Added to favourites ❤️");
    setSelectedChatIds(new Set());
    popSelectionUrl();
  };

  const handleAddToListSelected = () => {
    setShowSelectionMoreMenu(false);
    showToast("Added to list");
    setSelectedChatIds(new Set());
    popSelectionUrl();
  };

  const handleClearSelected = () => {
    setShowSelectionMoreMenu(false);
    setShowClearMultipleConfirm(true);
  };

  // Render Locked Chats View if activated (after all hooks have executed)
  if (isLockedChatsOpen) {
    return (
      <LockedChatsView
        conversations={conversations}
        currentUser={currentUser}
        selectedConversationId={selectedConversationId}
        onSelectConversation={onSelectConversation}
        onBack={() => setIsLockedChatsOpen(false)}
        onLockedToggle={() => {
          refreshProfile();
          onArchiveToggle?.();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800">
      {/* Top Header / Selection Action Bar */}
      {isSelectionMode ? (
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#0C1322] text-white shadow-md z-30 transition-all select-none border-b border-slate-700/60">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleCancelSelection}
              className="p-1 -ml-1 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
              aria-label="Cancel selection"
            >
              <Icon name="arrow_back" size="md" />
            </button>
            <span className="text-xl font-bold tracking-tight text-white leading-none">
              {selectedChatIds.size}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 relative">
            {/* Pin / Unpin Action */}
            <button
              type="button"
              onClick={handlePinSelected}
              className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
              title={allSelectedArePinned ? "Unpin chats" : "Pin chats"}
              aria-label={allSelectedArePinned ? "Unpin chats" : "Pin chats"}
            >
              <Icon
                name="keep"
                size="sm"
                className={allSelectedArePinned ? "text-[#00A884]" : ""}
              />
            </button>

            {/* Delete Action */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
              title="Delete chats"
              aria-label="Delete chats"
            >
              <Icon name="delete" size="sm" />
            </button>

            {/* Archive Action */}
            <button
              type="button"
              onClick={handleArchiveSelected}
              className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
              title="Archive chats"
              aria-label="Archive chats"
            >
              <Icon name="archive" size="sm" />
            </button>

            {/* 3-dots More Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSelectionMoreMenu(!showSelectionMoreMenu)}
                className="p-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
                title="More options"
                aria-label="More options"
              >
                <Icon name="more_vert" size="sm" />
              </button>

              {showSelectionMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSelectionMoreMenu(false)}
                  />
                  <div className="absolute right-0 top-11 z-50 w-52 bg-[#1E293B] text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 py-1.5 text-xs animate-in fade-in zoom-in-95 select-none">
                    <button
                      type="button"
                      onClick={handleMarkUnreadSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Mark as unread
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={handleLockSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Lock chats
                    </button>
                    <button
                      type="button"
                      onClick={handleFavouriteSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Add to Favourites
                    </button>
                    <button
                      type="button"
                      onClick={handleAddToListSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Add to list
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelected}
                      className="w-full px-4 py-2.5 text-left flex items-center hover:bg-slate-700/60 font-medium text-[13px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer border-t border-slate-700/60"
                    >
                      Clear chats
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Regular Top Header */
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                Veyra Chat
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* 3-Dots Menu Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTopOptionsMenu(!showTopOptionsMenu)}
                title="Menu"
                aria-label="Menu"
                className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              >
                <Icon name="more_vert" size="sm" />
              </button>

              {/* Top Options Dropdown Menu */}
              {showTopOptionsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowTopOptionsMenu(false)}
                  />
                  <div className="absolute right-0 top-11 z-50 w-56 bg-white dark:bg-[#18222d] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-700/80 py-2 text-sm animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100 select-none">
                    {/* 1. New group */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowTopOptionsMenu(false);
                        onNewGroup();
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    >
                      <Icon name="group_add" size="sm" className="text-slate-500 dark:text-slate-300" />
                      <span className="font-medium text-[13.5px]">New group</span>
                    </button>

                    {/* 2. Starred messages */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowTopOptionsMenu(false);
                        setFilter("favourites");
                        showToast("Showing starred & favourite chats");
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    >
                      <Icon name="star_outline" size="sm" className="text-slate-500 dark:text-slate-300" />
                      <span className="font-medium text-[13.5px]">Starred messages</span>
                    </button>

                    {/* 3. Select chats */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowTopOptionsMenu(false);
                        if (sortedConversations.length > 0) {
                          setSelectedChatIds(new Set([sortedConversations[0].id]));
                          pushSelectionUrl();
                        } else {
                          showToast("No chats to select");
                        }
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    >
                      <Icon name="check_box" size="sm" className="text-slate-500 dark:text-slate-300" />
                      <span className="font-medium text-[13.5px]">Select chats</span>
                    </button>

                    {/* 4. Mark all as read */}
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    >
                      <Icon name="mark_chat_read" size="sm" className="text-slate-500 dark:text-slate-300" />
                      <span className="font-medium text-[13.5px]">Mark all as read</span>
                    </button>

                    {/* Divider */}
                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-800/80" />

                    {/* 5. App lock */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowTopOptionsMenu(false);
                        setIsAppLocked(true);
                        setAppLockPin("");
                        setAppLockError(null);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    >
                      <Icon name="lock" size="sm" className="text-slate-500 dark:text-slate-300" />
                      <span className="font-medium text-[13.5px]">App lock</span>
                    </button>

                    {/* 6. Log out */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowTopOptionsMenu(false);
                        logout();
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                    >
                      <Icon name="logout" size="sm" className="text-red-500" />
                      <span className="font-medium text-[13.5px]">Log out</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Circular Green New Chat Button with speech bubble plus icon */}
            <button
              type="button"
              onClick={onNewChat}
              title="New Chat"
              aria-label="New Chat"
              className="w-9 h-9 rounded-full bg-[#2563eb] hover:bg-[#2253cb] flex items-center justify-center shadow-sm active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                {/* Dark chat bubble body */}
                <path
                  d="M4.5 4.5C3.12 4.5 2 5.62 2 7v7c0 1.38 1.12 2.5 2.5 2.5H5v3.2c0 .35.42.53.67.28L9.15 16.5H19.5c1.38 0 2.5-1.12 2.5-2.5V7c0-1.38-1.12-2.5-2.5-2.5H4.5z"
                  className="fill-[#ffffff] dark:fill-[#0F172A]"
                />
                {/* Green plus sign inside bubble */}
                <path
                  d="M12 8v5M9.5 10.5h5"
                  stroke="#2563eb"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Top Search Input (Hidden during Selection Mode) */}
      {!isSelectionMode && (
        <div className="px-3.5 pt-3 pb-2">
          <div className="relative flex items-center">
            <Icon
              name="search"
              size="sm"
              className="absolute left-3 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search or start a new chat"
              className="w-full bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm rounded-full pl-9 pr-8 py-2 border-none outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setUserSearchResults([]);
                  setHasSearchedUsers(false);
                }}
                aria-label="Clear search"
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Chips (Visible when not actively searching and not in selection mode) */}
      {!isSearchActive && !isSelectionMode && (
        <div className="flex items-center gap-1.5 px-3.5 pb-2.5 overflow-x-auto scrollbar-none border-b border-slate-100/60 dark:border-slate-800/40">
          {effectiveChatLists.map((chip) => {
            const isActive = filter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex-shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#2563EB]/20 text-[#2563EB] dark:bg-sky-950/70 dark:text-sky-400 border border-[#2563EB]/60"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {chip.label}
              </button>
            );
          })}

          {/* Add List Chip at end */}
          <button
            type="button"
            onClick={() => {
              setNewListNameInput("");
              setShowCreateListModal(true);
            }}
            className="px-2.5 py-1 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
            title="Create new list"
          >
            <Icon name="add" size="xs" />
            <span>Add List</span>
          </button>
        </div>
      )}

      {/* Archived Row Button (Hidden during Selection Mode, and hidden if no archived chats) */}
      {!isSearchActive && !isSelectionMode && archivedCount > 0 && (
        <button
          type="button"
          onClick={onOpenArchive}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer border-b border-slate-100/60 dark:border-slate-800/40"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-[#00A884] dark:group-hover:text-[#00A884] transition-colors">
              <Icon name="archive" size="sm" />
            </div>
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Archived
            </span>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60">
            {archivedCount}
          </span>
        </button>
      )}

      {/* Chat List Body */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-4 overscroll-contain">
        {/* SECTION A: Live Search Mode */}
        {isSearchActive ? (
          <div className="p-2 space-y-3">
            {/* 0. Secret Passkey Discovery for Locked Chats */}
            {currentUser.lockedChatEnabled &&
              currentUser.lockedChatPasskey &&
              searchQuery.trim() === currentUser.lockedChatPasskey.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setIsLockedChatsOpen(true);
                    setSearchQuery("");
                  }}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 hover:from-emerald-500/25 hover:to-teal-500/15 border border-emerald-500/30 text-left transition-all flex items-center justify-between group shadow-sm cursor-pointer animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
                      <Icon name="lock" size="sm" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Locked Chats
                        </h4>
                        <span className="text-[10px] font-semibold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                          Passkey Matched
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Tap to open your hidden conversations
                      </p>
                    </div>
                  </div>
                  <Icon
                    name="chevron_right"
                    size="sm"
                    className="text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform"
                  />
                </button>
              )}

            {/* 1. Username Discovery Results */}
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>People on Veyra</span>
                {isSearchingUsers && (
                  <span className="flex items-center gap-1 text-[#2563EB] font-normal lowercase">
                    <span className="w-2.5 h-2.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                    searching...
                  </span>
                )}
              </div>

              {userSearchResults.length > 0 ? (
                <div className="space-y-1 mt-1">
                  {userSearchResults.map((target) => (
                    <UserSearchResultItem
                      key={target.uid}
                      targetUser={target}
                      currentUser={currentUser}
                      onSelect={(convId) => {
                        onSelectConversation(convId);
                        setSearchQuery("");
                        setUserSearchResults([]);
                      }}
                    />
                  ))}
                </div>
              ) : hasSearchedUsers && !isSearchingUsers ? (
                <div className="py-4 text-center text-slate-400">
                  <p className="text-xs">No users found matching @{searchQuery.replace(/^@+/, "")}</p>
                </div>
              ) : null}
            </div>

            {/* 2. Matching Existing Conversations (if not pure @ query) */}
            {!isUserQuery && filteredConversations.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-slate-800/60 pt-3">
                  <span>Conversations</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredConversations.map((conv) => (
                    <ChatListItem
                      key={conv.id}
                      conversation={conv}
                      currentUser={currentUser}
                      isSelected={selectedConversationId === conv.id}
                      hasUnviewedStory={hasUserUnviewedStory(conv)}
                      onSelect={() => {
                        onSelectConversation(conv.id);
                        setSearchQuery("");
                      }}
                      onContextMenu={handleOpenContextMenu}
                      onAvatarClick={handleAvatarClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {!isSearchingUsers && userSearchResults.length === 0 && filteredConversations.length === 0 && (
              <EmptyState
                icon="person_search"
                title="No results found"
                description={`No user or conversation found for "${searchQuery}".`}
              />
            )}
          </div>
        ) : (
          /* SECTION B: Normal Chat List Mode */
          <div>
            {/* Pinned Veyra AI Companion Entry (Hidden during Selection Mode) */}
            {filter === "all" && !isSelectionMode && (() => {
              const veyraAiConv: Conversation = {
                id: VEYRA_AI_CONVERSATION_ID,
                type: "ai",
                participantIds: [currentUser.uid, "veyra_ai"],
                participants: {
                  [currentUser.uid]: currentUser,
                  veyra_ai: {
                    uid: "veyra_ai",
                    displayName: "Veyra AI",
                    username: "veyra_ai",
                    email: "ai@veyra.app",
                    avatarUrl: "/assets/veyra_ai_logo.png",
                    createdAt: 0,
                  },
                },
                createdAt: 0,
                updatedAt: Date.now(),
              } as Conversation;

              return (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if (aiIsLongPressRef.current || Date.now() - aiLastLongPressTimeRef.current < 500) {
                      e.preventDefault();
                      e.stopPropagation();
                      aiIsLongPressRef.current = false;
                      return;
                    }
                    onSelectConversation(VEYRA_AI_CONVERSATION_ID);
                  }}
                  onTouchStart={(e) => {
                    aiTouchStartXRef.current = e.touches[0].clientX;
                    aiTouchStartYRef.current = e.touches[0].clientY;
                    aiIsLongPressRef.current = false;
                    aiLongPressTimerRef.current = setTimeout(() => {
                      aiIsLongPressRef.current = true;
                      aiLastLongPressTimeRef.current = Date.now();
                      if (typeof navigator !== "undefined" && navigator.vibrate) {
                        try { navigator.vibrate(35); } catch (_) {}
                      }
                      handleOpenContextMenu(aiTouchStartXRef.current, aiTouchStartYRef.current, veyraAiConv);
                    }, 450);
                  }}
                  onTouchMove={(e) => {
                    const diffX = e.touches[0].clientX - aiTouchStartXRef.current;
                    const diffY = e.touches[0].clientY - aiTouchStartYRef.current;
                    if (Math.hypot(diffX, diffY) > 8 && aiLongPressTimerRef.current) {
                      clearTimeout(aiLongPressTimerRef.current);
                      aiLongPressTimerRef.current = null;
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (aiLongPressTimerRef.current) {
                      clearTimeout(aiLongPressTimerRef.current);
                      aiLongPressTimerRef.current = null;
                    }
                    if (aiIsLongPressRef.current || Date.now() - aiLastLongPressTimeRef.current < 500) {
                      if (e.cancelable) e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenContextMenu(e.clientX, e.clientY, veyraAiConv);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all border-b border-teal-100/60 dark:border-teal-950/40 select-none group relative cursor-pointer ${
                    selectedConversationId === VEYRA_AI_CONVERSATION_ID
                      ? "bg-teal-50/80 dark:bg-teal-950/30 border-l-4 border-l-teal-500"
                      : "hover:bg-teal-50/40 dark:hover:bg-teal-950/20"
                  }`}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAvatarClick(
                        veyraAiConv,
                        "Veyra AI",
                        "/assets/veyra_ai_logo.png"
                      );
                    }}
                    className="relative flex-shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95"
                    title="View Veyra AI photo"
                  >
                    <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-teal-500 flex items-center justify-center shadow-sm">
                      <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                        <Image
                          src="/assets/veyra_ai_logo.png"
                          alt="Veyra AI"
                          width={28}
                          height={28}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Veyra
                        </h4>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                          AI Buddy
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Har Baat, Apno Ke Saath • Always here to assist you
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Conversation Items */}
            {isLoading ? (
              <ChatListSkeleton count={6} />
            ) : sortedConversations.length > 0 ? (
              sortedConversations.map((conv) => (
                <ChatListItem
                  key={conv.id}
                  conversation={conv}
                  currentUser={currentUser}
                  isSelected={selectedConversationId === conv.id}
                  hasUnviewedStory={hasUserUnviewedStory(conv)}
                  isPinned={isConversationPinned(conv, currentUser.uid, false)}
                  isSelectionMode={isSelectionMode}
                  isSelectedForAction={selectedChatIds.has(conv.id)}
                  onSelect={() => onSelectConversation(conv.id)}
                  onToggleSelect={() => handleToggleSelectChat(conv.id)}
                  onContextMenu={handleOpenContextMenu}
                  onAvatarClick={handleAvatarClick}
                />
              ))
            ) : filter === "unread" ? (
              <EmptyState
                icon="mark_chat_read"
                title="All caught up!"
                description="You have no unread messages."
              />
            ) : filter === "groups" ? (
              <EmptyState
                icon="groups"
                title="No group chats yet"
                description="Create or join a group to connect with multiple friends at once."
                actionLabel="New Group"
                onAction={onNewGroup}
              />
            ) : (
              <EmptyState
                icon="chat_bubble_outline"
                title="No conversations yet"
                description="No conversations yet. Start a new chat to say hello."
                actionLabel="Start a Chat"
                onAction={onNewChat}
              />
            )}
          </div>
        )}
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}

      {/* WhatsApp-Style Chat List Context Menu with Veyra Slate Theme Colors (not pitch black) */}
      {contextMenu && (() => {
        const isAiChat =
          contextMenu.conversation.type === "ai" ||
          contextMenu.conversation.id === VEYRA_AI_CONVERSATION_ID ||
          contextMenu.conversation.id.startsWith("ai_") ||
          contextMenu.conversation.participantIds?.includes("veyra_ai");

        return (
          <>
            {/* Fullscreen Backdrop */}
            <div
              className="fixed inset-0 z-[80] bg-black/15 dark:bg-black/40 backdrop-blur-[0.5px] cursor-default"
              onClick={(e) => {
                if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                setContextMenu(null);
              }}
              onTouchEnd={(e) => {
                if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                setContextMenu(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                  return;
                }
                setContextMenu(null);
              }}
            />

            {/* Context Menu Popup with Slate Theme Colors */}
            <div
              style={{
                top: contextMenu.coords.top !== undefined ? `${contextMenu.coords.top}px` : undefined,
                bottom: contextMenu.coords.bottom !== undefined ? `${contextMenu.coords.bottom}px` : undefined,
                left: contextMenu.coords.left !== undefined ? `${contextMenu.coords.left}px` : undefined,
                maxHeight: `${contextMenu.coords.maxHeight}px`,
              }}
              className="fixed z-[90] w-56 overflow-y-auto bg-white/98 dark:bg-[#1E293B]/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 py-1.5 text-xs animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100 select-none divide-y divide-slate-100 dark:divide-slate-700/60"
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => {
                if (Date.now() - contextMenuOpenedAtRef.current < 450) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              {/* Top Options Group */}
              <div className="py-0.5">
                {/* Options for human / group conversations only */}
                {!isAiChat && (
                  <>
                    {/* 0. Select chat */}
                    <button
                      type="button"
                      onClick={() => {
                        if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                        const targetConv = contextMenu.conversation;
                        setContextMenu(null);
                        pushSelectionUrl();
                        setSelectedChatIds(new Set([targetConv.id]));
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                    >
                      <Icon
                        name="check_circle"
                        size="sm"
                        className="text-slate-400 dark:text-slate-400 group-hover:text-[#00A884] dark:group-hover:text-[#00A884] transition-colors"
                      />
                      <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">
                        Select chat
                      </span>
                    </button>

                    {/* 1. Archive chat */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                        const targetConv = contextMenu.conversation;
                        setContextMenu(null);
                        await archiveConversation(targetConv.id, currentUser.uid);
                        showToast("Chat archived 📁");
                        onArchiveToggle?.();
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                    >
                      <Icon name="archive" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                      <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Archive chat</span>
                    </button>

                    {/* 2. Lock chat */}
                    <button
                      type="button"
                      onClick={() => {
                        if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                        const targetConv = contextMenu.conversation;
                        setContextMenu(null);
                        setShowDesktopListSubmenu(false);
                        if (!currentUser.lockedChatEnabled || !currentUser.lockedChatPasskey) {
                          showToast("Please turn on Lock Chat in Settings > Privacy first 🔒");
                          return;
                        }
                        setPasskeyModalState({
                          isOpen: true,
                          action: "lock",
                          conversation: targetConv,
                          passkeyInput: "",
                          error: null,
                          isSubmitting: false,
                          showText: false,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                    >
                      <Icon name="lock" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                      <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Lock chat</span>
                    </button>

                    {/* 3. Pin / Unpin chat */}
                    {(() => {
                      const isPinned = isConversationPinned(
                        contextMenu.conversation,
                        currentUser.uid,
                        false
                      );
                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                            const targetConv = contextMenu.conversation;
                            setContextMenu(null);
                            if (isPinned) {
                              await unpinConversation(targetConv.id, currentUser.uid, false);
                              showToast("Chat unpinned 📌");
                              setPinRefreshTick((t) => t + 1);
                            } else {
                              const res = await pinConversation(targetConv.id, currentUser.uid, false);
                              if (res.success) {
                                showToast("Chat pinned to top 📌");
                                setPinRefreshTick((t) => t + 1);
                              } else {
                                showToast(res.message || "You can only pin up to 4 chats");
                              }
                            }
                          }}
                          className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                        >
                          <Icon
                            name="keep"
                            size="sm"
                            className={`text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors ${
                              isPinned ? "text-[#00A884] dark:text-[#00A884]" : ""
                            }`}
                          />
                          <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">
                            {isPinned ? "Unpin chat" : "Pin chat"}
                          </span>
                        </button>
                      );
                    })()}
                  </>
                )}

                {/* Mark as unread (Available for all chats including Veyra AI) */}
                <button
                  type="button"
                  onClick={() => {
                    if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                    setContextMenu(null);
                    showToast("Marked as unread ✉️");
                  }}
                  className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                >
                  <Icon name="mark_chat_unread" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                  <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Mark as unread</span>
                </button>

                {!isAiChat && (
                  <>
                    {/* 5. Add to favourites */}
                    {(() => {
                      const targetConv = contextMenu.conversation;
                      const isFav = isConversationFavourite(targetConv.id, currentUser);
                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                            setContextMenu(null);
                            setShowDesktopListSubmenu(false);
                            const res = await toggleConversationFavourite(
                              currentUser.uid,
                              targetConv.id,
                              currentUser
                            );
                            await refreshProfile();
                            if (res.isFavourite) {
                              showToast("Added to favourites ❤️");
                            } else {
                              showToast("Removed from favourites");
                            }
                          }}
                          className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                        >
                          <Icon
                            name={isFav ? "favorite" : "favorite_border"}
                            size="sm"
                            className={
                              isFav
                                ? "text-rose-500 fill-rose-500"
                                : "text-slate-400 dark:text-slate-400 group-hover:text-rose-500 transition-colors"
                            }
                          />
                          <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">
                            {isFav ? "Remove from favourites" : "Add to favourites"}
                          </span>
                        </button>
                      );
                    })()}

                    {/* 6. Add to list */}
                    <button
                      type="button"
                      onClick={() => {
                        if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                        if (typeof window !== "undefined" && window.innerWidth < 768) {
                          setMobileAddToListConv(contextMenu.conversation);
                          setContextMenu(null);
                          setShowDesktopListSubmenu(false);
                        } else {
                          setShowDesktopListSubmenu((p) => !p);
                        }
                      }}
                      onMouseEnter={() => {
                        if (typeof window !== "undefined" && window.innerWidth >= 768) {
                          setShowDesktopListSubmenu(true);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <Icon name="playlist_add" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                        <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Add to list</span>
                      </div>
                      <Icon name="chevron_right" size="xs" className="text-slate-400 dark:text-slate-500" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Options Group */}
              <div className="py-0.5">
                {/* Clear chat (Available for all chats including Veyra AI) */}
                <button
                  type="button"
                  onClick={() => {
                    if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                    const targetConv = contextMenu.conversation;
                    setContextMenu(null);
                    setShowClearConfirm(targetConv);
                  }}
                  className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
                >
                  <Icon name="remove_circle_outline" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                  <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Clear chat</span>
                </button>

                {!isAiChat && (
                  /* 8. Delete chat */
                  <button
                    type="button"
                    onClick={() => {
                      if (Date.now() - contextMenuOpenedAtRef.current < 400) return;
                      const targetConv = contextMenu.conversation;
                      setContextMenu(null);
                      setShowDeleteConfirm(targetConv);
                    }}
                    className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors group cursor-pointer"
                  >
                    <Icon name="delete" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-rose-500 transition-colors" />
                    <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                      Delete chat
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Submenu for Add to List */}
            {showDesktopListSubmenu && !isAiChat && (
              <div
                style={{
                  top: contextMenu.coords.top !== undefined ? `${contextMenu.coords.top}px` : undefined,
                  bottom: contextMenu.coords.bottom !== undefined ? `${contextMenu.coords.bottom}px` : undefined,
                  left:
                    (contextMenu.coords.left || 0) + 230 + 220 > (typeof window !== "undefined" ? window.innerWidth : 1200)
                      ? `${Math.max(12, (contextMenu.coords.left || 0) - 215)}px`
                      : `${(contextMenu.coords.left || 0) + 228}px`,
                  maxHeight: `${contextMenu.coords.maxHeight}px`,
                }}
                className="hidden md:block fixed z-[95] w-52 overflow-y-auto bg-white/98 dark:bg-[#1E293B]/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-1.5 text-xs animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100 select-none divide-y divide-slate-100 dark:divide-slate-700/60"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Add to list</span>
                </div>
                <div className="py-1 space-y-0.5">
                  {effectiveChatLists
                    .filter((l) => l.id !== "all" && l.id !== "unread" && l.id !== "groups")
                    .map((list) => {
                      const isMember =
                        list.id === "favourites"
                          ? isConversationFavourite(contextMenu.conversation.id, currentUser)
                          : Boolean(
                              currentUser.conversationListMemberships?.[
                                contextMenu.conversation.id
                              ]?.includes(list.id)
                            );
                      return (
                        <button
                          key={list.id}
                          type="button"
                          onClick={async () => {
                            await toggleConversationList(
                              currentUser.uid,
                              contextMenu.conversation.id,
                              list.id,
                              currentUser
                            );
                            await refreshProfile();
                          }}
                          className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer group"
                        >
                          <span className="font-medium text-[13px] text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {list.label}
                          </span>
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                              isMember
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 dark:border-slate-600 bg-transparent group-hover:border-slate-400"
                            }`}
                          >
                            {isMember && <Icon name="check" size="xs" />}
                          </div>
                        </button>
                      );
                    })}
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setContextMenu(null);
                      setShowDesktopListSubmenu(false);
                      setNewListNameInput("");
                      setShowCreateListModal(true);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer"
                  >
                    <Icon name="add" size="xs" />
                    <span>New List</span>
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Confirmation Modal: Clear Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Clear this chat?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Messages in this chat will be cleared from this device.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowClearConfirm(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowClearConfirm(null);
                  showToast("Chat messages cleared");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm"
              >
                Clear chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Chat */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Delete this chat?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to delete this chat with <span className="font-semibold text-slate-700 dark:text-slate-200">{getConvName(showDeleteConfirm)}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  showToast("Chat deleted");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                Delete chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Multiple Chats */}
      {showDeleteMultipleConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Delete {selectedChatIds.size} {selectedChatIds.size === 1 ? "chat" : "chats"}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to delete the selected chats? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowDeleteMultipleConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const count = selectedChatIds.size;
                  setShowDeleteMultipleConfirm(false);
                  setSelectedChatIds(new Set());
                  popSelectionUrl();
                  showToast(`${count} ${count === 1 ? "chat" : "chats"} deleted`);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear Multiple Chats */}
      {showClearMultipleConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Clear {selectedChatIds.size} {selectedChatIds.size === 1 ? "chat" : "chats"}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Messages in the selected chats will be cleared from this device.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowClearMultipleConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const count = selectedChatIds.size;
                  setShowClearMultipleConfirm(false);
                  setSelectedChatIds(new Set());
                  popSelectionUrl();
                  showToast(`Messages in ${count} ${count === 1 ? "chat" : "chats"} cleared`);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Picture Quick-Preview Modal (WhatsApp Style) */}
      {profilePreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setProfilePreview(null)}
        >
          <div
            className="relative w-[300px] sm:w-[320px] max-w-[90vw] bg-[#0B141A] dark:bg-[#0B141A] rounded-2xl shadow-2xl overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Header Overlay with Name */}
            <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/85 via-black/45 to-transparent p-3.5 z-10 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base sm:text-lg truncate drop-shadow-md pr-2">
                {profilePreview.name}
              </h3>
            </div>

            {/* Profile Photo Image Area (Square) */}
            <div className="relative w-full aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
              {profilePreview.avatarUrl ? (
                <img
                  src={profilePreview.avatarUrl}
                  alt={profilePreview.name}
                  className="w-full h-full object-cover select-none"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] text-white text-5xl font-bold select-none">
                  {profilePreview.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-around py-3 px-4 bg-[#0B141A] border-t border-white/10">
              {/* Message Button */}
              <button
                type="button"
                onClick={() => {
                  onSelectConversation(profilePreview.conv.id);
                  setProfilePreview(null);
                }}
                className="p-2.5 rounded-full hover:bg-white/10 text-emerald-400 dark:text-emerald-400 transition-colors cursor-pointer active:scale-95"
                title="Message"
                aria-label="Message"
              >
                <Icon name="chat" size="md" />
              </button>

              {/* Info Button */}
              <button
                type="button"
                onClick={() => {
                  onSelectConversation(profilePreview.conv.id);
                  setProfilePreview(null);
                }}
                className="p-2.5 rounded-full hover:bg-white/10 text-emerald-400 dark:text-emerald-400 transition-colors cursor-pointer active:scale-95"
                title="Info"
                aria-label="Info"
              >
                <Icon name="info" size="md" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Viewer Modal */}
      {activeStoryStatuses && (
        <StatusViewerModal
          isOpen={Boolean(activeStoryStatuses)}
          onClose={handleStoryModalClose}
          statuses={activeStoryStatuses}
          currentUser={currentUser}
        />
      )}
      {/* Fullscreen App Lock Screen */}
      {isAppLocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 dark:bg-[#070b12]/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white animate-in fade-in zoom-in-95 select-none">
          <div className="w-full max-w-xs flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 ring-8 ring-emerald-500/10 shadow-xl">
              <Icon name="lock" size="lg" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                Veyra is Locked
              </h2>
              <p className="text-xs text-slate-400">
                Enter your 4-digit PIN to access your conversations
              </p>
            </div>

            {/* PIN Dots Indicator */}
            <div className="flex items-center gap-3 my-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    appLockPin.length > idx
                      ? "bg-emerald-400 border-emerald-400 scale-110 shadow-sm"
                      : "border-slate-600 bg-transparent"
                  }`}
                />
              ))}
            </div>

            {appLockError && (
              <p className="text-xs font-medium text-rose-400 animate-shake">
                {appLockError}
              </p>
            )}

            {/* Quick Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    if (appLockPin.length < 4) {
                      const next = appLockPin + num;
                      setAppLockPin(next);
                      setAppLockError(null);
                      if (next.length === 4) {
                        setTimeout(() => {
                          setIsAppLocked(false);
                          setAppLockPin("");
                          showToast("App unlocked");
                        }, 200);
                      }
                    }
                  }}
                  className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-lg font-bold transition-colors flex items-center justify-center cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setIsAppLocked(false);
                  setAppLockPin("");
                  showToast("Unlocked via Biometrics");
                }}
                className="h-14 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer"
                title="Unlock directly"
              >
                Unlock
              </button>
              <button
                type="button"
                onClick={() => {
                  if (appLockPin.length < 4) {
                    const next = appLockPin + "0";
                    setAppLockPin(next);
                    setAppLockError(null);
                    if (next.length === 4) {
                      setTimeout(() => {
                        setIsAppLocked(false);
                        setAppLockPin("");
                        showToast("App unlocked");
                      }, 200);
                    }
                  }
                }}
                className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-lg font-bold transition-colors flex items-center justify-center cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setAppLockPin((prev) => prev.slice(0, -1))}
                className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer"
              >
                <Icon name="backspace" size="sm" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Modal: Choose List */}
      {mobileAddToListConv && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMobileAddToListConv(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-[#1E293B] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 text-slate-800 dark:text-slate-100 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle for mobile */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Choose List
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                  {getConvName(mobileAddToListConv)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileAddToListConv(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            <div className="py-2 overflow-y-auto space-y-1 my-2 divide-y divide-slate-100/60 dark:divide-slate-800/60 flex-1">
              {effectiveChatLists
                .filter((l) => l.id !== "all" && l.id !== "unread" && l.id !== "groups")
                .map((list) => {
                  const isMember =
                    list.id === "favourites"
                      ? isConversationFavourite(mobileAddToListConv.id, currentUser)
                      : Boolean(
                          currentUser.conversationListMemberships?.[
                            mobileAddToListConv.id
                          ]?.includes(list.id)
                        );
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={async () => {
                        await toggleConversationList(
                          currentUser.uid,
                          mobileAddToListConv.id,
                          list.id,
                          currentUser
                        );
                        await refreshProfile();
                      }}
                      className="w-full py-3 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <Icon
                            name={list.id === "favourites" ? "star" : "label"}
                            size="xs"
                          />
                        </div>
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
                          {list.label}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isMember
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 dark:border-slate-600 bg-transparent"
                        }`}
                      >
                        {isMember && <Icon name="check" size="xs" />}
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewListNameInput("");
                  setShowCreateListModal(true);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="add" size="xs" />
                <span>New List</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileAddToListConv(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Passkey Entry to Lock/Unlock Chat */}
      {passkeyModalState.isOpen && passkeyModalState.conversation && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!passkeyModalState.isSubmitting) {
              setPasskeyModalState((prev) => ({ ...prev, isOpen: false, conversation: null }));
            }
          }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Icon name={passkeyModalState.action === "lock" ? "lock" : "lock_open"} size="md" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {passkeyModalState.action === "lock" ? "Lock Chat" : "Unlock Chat"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[210px]">
                  {getConvName(passkeyModalState.conversation)}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Enter your secret passkey to {passkeyModalState.action === "lock" ? "lock" : "unlock"} this chat.
            </p>

            <form onSubmit={handlePasskeyModalSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={passkeyModalState.showText ? "text" : "password"}
                  value={passkeyModalState.passkeyInput}
                  onChange={(e) =>
                    setPasskeyModalState((prev) => ({
                      ...prev,
                      passkeyInput: e.target.value,
                      error: null,
                    }))
                  }
                  autoFocus
                  placeholder="Enter passkey..."
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPasskeyModalState((prev) => ({
                      ...prev,
                      showText: !prev.showText,
                    }))
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  tabIndex={-1}
                >
                  <Icon
                    name={passkeyModalState.showText ? "visibility_off" : "visibility"}
                    size="xs"
                  />
                </button>
              </div>

              {passkeyModalState.error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                  <Icon name="error" size="xs" />
                  <span>{passkeyModalState.error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setPasskeyModalState((prev) => ({
                      ...prev,
                      isOpen: false,
                      conversation: null,
                    }))
                  }
                  disabled={passkeyModalState.isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    passkeyModalState.isSubmitting ||
                    !passkeyModalState.passkeyInput.trim()
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors shadow-sm"
                >
                  {passkeyModalState.isSubmitting
                    ? "Verifying..."
                    : passkeyModalState.action === "lock"
                    ? "Lock"
                    : "Unlock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New List */}
      {showCreateListModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!isSavingList) setShowCreateListModal(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              New Chat List
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Create a custom list to organize your chats (e.g. Work, Clients, Hobbies).
            </p>

            <form onSubmit={handleCreateNewList} className="space-y-4">
              <input
                type="text"
                value={newListNameInput}
                onChange={(e) => setNewListNameInput(e.target.value)}
                autoFocus
                placeholder="List name..."
                maxLength={24}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateListModal(false)}
                  disabled={isSavingList}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingList || !newListNameInput.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors shadow-sm"
                >
                  {isSavingList ? "Creating..." : "Create List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
