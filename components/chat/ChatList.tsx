"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Conversation, UserProfile } from "@/types";
import { ChatListItem } from "./ChatListItem";
import { ChatListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { searchUsersByUsername } from "@/lib/firestore/userService";
import { createDirectConversation } from "@/lib/firestore/conversationService";
import { subscribeToUserPresence } from "@/lib/realtime/presenceService";
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
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center p-0.5 bg-blue-50 dark:bg-blue-950/40">
            <Image
              src="/assets/main_logo.png"
              alt="Veyra"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
              Chats
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
                      onSelect={() => {
                        onSelectConversation(conv.id);
                        setSearchQuery("");
                      }}
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
              <button
                onClick={() => onSelectConversation(VEYRA_AI_CONVERSATION_ID)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all border-b border-teal-100/60 dark:border-teal-950/40 select-none group relative ${
                  selectedConversationId === VEYRA_AI_CONVERSATION_ID
                    ? "bg-teal-50/80 dark:bg-teal-950/30 border-l-4 border-l-teal-500"
                    : "hover:bg-teal-50/40 dark:hover:bg-teal-950/20"
                }`}
              >
                <div className="relative flex-shrink-0">
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
              </button>
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
                  onSelect={() => onSelectConversation(conv.id)}
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
    </div>
  );
};
