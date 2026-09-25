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

interface ChatListProps {
  conversations: Conversation[];
  currentUser: UserProfile;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  isLoading: boolean;
}

type FilterChip = "all" | "unread" | "groups";

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
}) => {
  const [filter, setFilter] = useState<FilterChip>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const [showClearConfirm, setShowClearConfirm] = useState<Conversation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Conversation | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const getConvName = (conv: Conversation) => {
    if (conv.type === "group") return conv.groupName || "Group";
    if (conv.type === "ai") return "Veyra AI";
    const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
    return (otherId ? conv.participants?.[otherId]?.displayName : null) || "User";
  };

  const handleOpenContextMenu = (x: number, y: number, conv: Conversation) => {
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

  // Avatar click handler: opens user's story if unviewed, else opens WhatsApp-style profile preview modal
  const handleAvatarClick = (conv: Conversation, name: string, avatarUrl: string) => {
    if (conv.type === "direct") {
      const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
      const group = otherId ? statusGroups.find((g) => g.userId === otherId) : null;
      if (group && group.hasUnviewed && group.statuses.length > 0) {
        // Open the user's unviewed story!
        setActiveStoryStatuses(group.statuses);
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
    // If user search starts with '@', do not search inside group conversations
    if (isUserQuery && c.type === "group") {
      return false;
    }

    // 1. Filter chip check
    if (filter === "groups" && c.type !== "group") return false;
    if (filter === "unread") {
      const count = c.unreadCount?.[currentUser.uid] || 0;
      if (count === 0) return false;
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
              Veyra
            </h2>
            <span className="text-[10px] text-slate-400 font-medium">Har Baat, Apno Ke Saath</span>
          </div>
        </div>

        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => setShowNewMenu(!showNewMenu)}
            title="New Chat or Group"
            aria-label="New Chat or Group"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Icon name="add" size="sm" />
          </button>

          {showNewMenu && (
            <div className="absolute right-0 top-11 z-30 w-44 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 text-xs animate-in fade-in zoom-in-95">
              <button
                onClick={() => {
                  setShowNewMenu(false);
                  onNewChat();
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200"
              >
                <Icon name="chat" size="xs" className="text-[#2563EB]" />
                <span className="font-medium">New Chat</span>
              </button>

              <button
                onClick={() => {
                  setShowNewMenu(false);
                  onNewGroup();
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-t border-slate-100 dark:border-slate-800"
              >
                <Icon name="groups" size="xs" className="text-[#14B8A6]" />
                <span className="font-medium">New Group</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Search Input */}
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
            placeholder="Search @username or chats..."
            className="w-full bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs rounded-xl pl-9 pr-8 py-2 border-none outline-none focus:ring-1 focus:ring-[#2563EB]"
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

      {/* Filter Chips (Visible when not actively searching) */}
      {!isSearchActive && (
        <div className="flex items-center gap-1.5 px-3.5 pb-2.5 overflow-x-auto scrollbar-none border-b border-slate-100/60 dark:border-slate-800/40">
          {(
            [
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
              { id: "groups", label: "Groups" },
            ] as const
          ).map((chip) => {
            const isActive = filter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex-shrink-0 ${
                  isActive
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Chat List Body */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-4 overscroll-contain">
        {/* SECTION A: Live Search Mode */}
        {isSearchActive ? (
          <div className="p-2 space-y-3">
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
            {/* Pinned Veyra AI Companion Entry */}
            {filter === "all" && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectConversation(VEYRA_AI_CONVERSATION_ID)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenContextMenu(e.clientX, e.clientY, {
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
                  } as Conversation);
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
                      {
                        id: VEYRA_AI_CONVERSATION_ID,
                        type: "ai",
                        participantIds: [currentUser.uid, "veyra_ai"],
                        participants: {},
                        createdAt: 0,
                        updatedAt: Date.now(),
                      } as Conversation,
                      "Veyra AI",
                      "/assets/veyra_ai_logo.png"
                    );
                  }}
                  className="relative flex-shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95"
                  title="View Veyra AI photo"
                >
                  <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-teal-400 to-emerald-500 flex items-center justify-center shadow-sm">
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
            )}

            {/* Conversation Items */}
            {isLoading ? (
              <ChatListSkeleton count={6} />
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <ChatListItem
                  key={conv.id}
                  conversation={conv}
                  currentUser={currentUser}
                  isSelected={selectedConversationId === conv.id}
                  hasUnviewedStory={hasUserUnviewedStory(conv)}
                  onSelect={() => onSelectConversation(conv.id)}
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
      {contextMenu && (
        <>
          {/* Fullscreen Backdrop */}
          <div
            className="fixed inset-0 z-[80] bg-black/15 dark:bg-black/40 backdrop-blur-[0.5px] cursor-default"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
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
          >
            {/* Top Options Group */}
            <div className="py-0.5">
              {/* 1. Archive chat */}
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  showToast("Chat archived 📁");
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
                  setContextMenu(null);
                  showToast("Chat locked with passkey 🔒");
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon name="lock" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Lock chat</span>
              </button>

              {/* 3. Pin chat */}
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  showToast("Chat pinned to top 📌");
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon name="keep" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Pin chat</span>
              </button>

              {/* 4. Mark as unread */}
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  showToast("Marked as unread ✉️");
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon name="mark_chat_unread" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Mark as unread</span>
              </button>

              {/* 5. Add to favourites */}
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  showToast("Added to favourites ❤️");
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon name="favorite_border" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-rose-500 transition-colors" />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Add to favourites</span>
              </button>

              {/* 6. Add to list */}
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  showToast("List management coming soon");
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <Icon name="playlist_add" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                  <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Add to list</span>
                </div>
                <Icon name="chevron_right" size="xs" className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            {/* Bottom Options Group */}
            <div className="py-0.5">
              {/* 7. Clear chat */}
              <button
                type="button"
                onClick={() => {
                  const targetConv = contextMenu.conversation;
                  setContextMenu(null);
                  setShowClearConfirm(targetConv);
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group cursor-pointer"
              >
                <Icon name="remove_circle_outline" size="sm" className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                <span className="font-medium text-[13.5px] text-slate-800 dark:text-slate-200">Clear chat</span>
              </button>

              {/* 8. Delete chat */}
              <button
                type="button"
                onClick={() => {
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
            </div>
          </div>
        </>
      )}

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
          onClose={() => setActiveStoryStatuses(null)}
          statuses={activeStoryStatuses}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
