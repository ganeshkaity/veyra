"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { searchUsersByUsername } from "@/lib/firestore/userService";
import { createDirectConversation } from "@/lib/firestore/conversationService";
import { subscribeToUserPresence } from "@/lib/realtime/presenceService";
import { UserProfile } from "@/types";

interface NewChatResultItemProps {
  target: UserProfile;
  isLoading: boolean;
  onSelect: () => void;
}

const NewChatResultItem: React.FC<NewChatResultItemProps> = ({
  target,
  isLoading,
  onSelect,
}) => {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeToUserPresence(target.uid, (p) => {
      setIsOnline(p?.isOnline ?? false);
    });
    return () => unsub();
  }, [target.uid]);

  return (
    <div
      onClick={onSelect}
      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-100 dark:border-slate-800/50 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={target.displayName} src={target.avatarUrl} size="md" isOnline={isOnline} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-[#2563EB] transition-colors truncate">
              {target.displayName}
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
            @{target.username}
          </p>
        </div>
      </div>

      <button
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 flex-shrink-0"
      >
        {isLoading ? (
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

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onConversationCreated: (conversationId: string) => void;
  onOpenNewGroup?: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onConversationCreated,
  onOpenNewGroup,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingUserUid, setLoadingUserUid] = useState<string | null>(null);

  const handleSearch = async (val: string) => {
    setQuery(val);
    const cleaned = val.trim().replace(/^@+/, "");
    if (!cleaned) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const found = await searchUsersByUsername(cleaned);
      // Filter out self
      setResults(found.filter((u) => u.uid !== currentUser.uid));
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (targetUser: UserProfile) => {
    try {
      setLoadingUserUid(targetUser.uid);
      const convId = await createDirectConversation(currentUser, targetUser);
      onConversationCreated(convId);
      onClose();
    } catch (err) {
      console.error("Failed to start chat:", err);
    } finally {
      setLoadingUserUid(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start a New Chat" maxWidth="md">
      <div className="space-y-3.5">
        {/* New Group Option Button */}
        {onOpenNewGroup && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewGroup();
            }}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-teal-500/10 to-transparent hover:from-blue-500/15 hover:via-teal-500/15 border border-blue-500/20 text-left flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] text-white flex items-center justify-center shadow-sm">
                <Icon name="groups" size="sm" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#2563EB] dark:group-hover:text-[#14B8A6] transition-colors">
                  New Group
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select users, name your group, and chat together
                </p>
              </div>
            </div>
            <Icon
              name="chevron_right"
              size="sm"
              className="text-slate-400 group-hover:translate-x-0.5 transition-transform"
            />
          </button>
        )}

        <Input
          type="text"
          placeholder="Search by @username..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          leftIcon={<Icon name="search" size="sm" />}
          autoFocus
        />

        {/* Results List */}
        <div className="min-h-[220px] max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {isSearching && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <span className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-xs">Searching users...</span>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-1 py-1">
              {results.map((target) => (
                <NewChatResultItem
                  key={target.uid}
                  target={target}
                  isLoading={loadingUserUid === target.uid}
                  onSelect={() => handleSelectUser(target)}
                />
              ))}
            </div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                <Icon name="person_search" size="md" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No users found
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Check the username spelling and try again.
              </p>
            </div>
          )}

          {!hasSearched && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <Icon name="search" size="lg" className="mb-2 opacity-50" />
              <p className="text-xs">Type a username to discover people on Veyra</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
