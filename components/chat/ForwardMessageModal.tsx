"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessage, Conversation, UserProfile } from "@/types";
import {
  subscribeToConversations,
  forwardMessage,
  createDirectConversation,
} from "@/lib/firestore/conversationService";
import { searchUsersByUsername } from "@/lib/firestore/userService";
import { WhatsAppForwardIcon } from "./WhatsAppForwardIcon";

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  currentUser: UserProfile;
  onForwardSuccess?: (targetConvId: string) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  onClose,
  message,
  currentUser,
  onForwardSuccess,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [sendingToId, setSendingToId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Subscribe to existing conversations
  useEffect(() => {
    if (!isOpen || !currentUser.uid) return;
    const unsub = subscribeToConversations(currentUser.uid, (list) => {
      setConversations(list);
    });
    return () => unsub();
  }, [isOpen, currentUser.uid]);

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setUserSearchResults([]);
      setSendingToId(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Handle search input (filters local conversations and searches global users if starting with @ or typing)
  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    const cleaned = val.trim().replace(/^@+/, "");
    if (!cleaned) {
      setUserSearchResults([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const users = await searchUsersByUsername(cleaned);
      // Filter out current user
      setUserSearchResults(users.filter((u) => u.uid !== currentUser.uid));
    } catch (err) {
      console.error("User search error:", err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Helper to extract other participant in 1-to-1 conversation
  const getConversationDetails = (conv: Conversation) => {
    if (conv.type === "group") {
      return {
        title: conv.groupName || "Group Chat",
        subtitle: `${conv.participantIds.length} members`,
        avatarUrl: conv.groupAvatar,
      };
    }
    const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
    const other = otherId ? conv.participants?.[otherId] : null;
    return {
      title: other?.displayName || "Veyra User",
      subtitle: other?.username ? `@${other.username}` : "Direct message",
      avatarUrl: other?.avatarUrl,
    };
  };

  // Filter local conversations by query
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace(/^@+/, "");
    const { title, subtitle } = getConversationDetails(c);
    return title.toLowerCase().includes(q) || subtitle.toLowerCase().includes(q);
  });

  // Forward to an existing conversation
  const handleForwardToConversation = async (conv: Conversation) => {
    if (!message) return;
    try {
      setSendingToId(conv.id);
      setErrorMsg(null);
      await forwardMessage(conv.id, message, currentUser);
      onForwardSuccess?.(conv.id);
      onClose();
    } catch (err: any) {
      console.error("Failed to forward message:", err);
      setErrorMsg(err.message || "Failed to forward message. Please try again.");
    } finally {
      setSendingToId(null);
    }
  };

  // Forward to a searched user (create conversation if needed, then forward)
  const handleForwardToUser = async (targetUser: UserProfile) => {
    if (!message) return;
    try {
      setSendingToId(targetUser.uid);
      setErrorMsg(null);
      const convId = await createDirectConversation(currentUser, targetUser);
      await forwardMessage(convId, message, currentUser);
      onForwardSuccess?.(convId);
      onClose();
    } catch (err: any) {
      console.error("Failed to forward message to user:", err);
      setErrorMsg(err.message || "Failed to forward message. Please try again.");
    } finally {
      setSendingToId(null);
    }
  };

  if (!isOpen || !message) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Forward Message" maxWidth="md">
      <div className="space-y-4">
        {/* Message preview snippet */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
          {message.mediaUrl ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 flex-shrink-0 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60">
              <img
                src={message.mediaUrl}
                alt="Media preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 dark:bg-[#14B8A6]/10 flex items-center justify-center text-[#2563EB] dark:text-[#14B8A6] flex-shrink-0">
              <WhatsAppForwardIcon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Forwarding
            </span>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
              {message.type === "image"
                ? message.text ? `📷 ${message.text}` : "📷 Photo"
                : message.type === "gif"
                ? "👾 GIF"
                : message.type === "sticker"
                ? `${message.text || "Sticker"}`
                : message.text}
            </p>
          </div>
        </div>

        {/* Error notice */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Search input */}
        <Input
          type="text"
          placeholder="Search chats or @username..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          leftIcon={<Icon name="search" size="sm" />}
          autoFocus
        />

        {/* List of Destinations */}
        <div className="min-h-[220px] max-h-[320px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
          {/* Recent Conversations */}
          {filteredConversations.length > 0 && (
            <div className="pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1 block">
                Recent Chats
              </span>
              {filteredConversations.map((conv) => {
                const { title, subtitle, avatarUrl } = getConversationDetails(conv);
                const isSending = sendingToId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => !isSending && handleForwardToConversation(conv)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={title} src={avatarUrl} size="md" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-[#2563EB] transition-colors truncate">
                          {title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {subtitle}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSending}
                      className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 flex-shrink-0"
                    >
                      {isSending ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Icon name="send" size="xs" />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Searched Users (if user query entered) */}
          {searchQuery.trim() && (
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1 block">
                Users matching &quot;{searchQuery}&quot;
              </span>
              {isSearchingUsers ? (
                <div className="flex items-center justify-center py-6 text-slate-400 text-xs">
                  <span className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
                  Searching...
                </div>
              ) : userSearchResults.length > 0 ? (
                userSearchResults.map((user) => {
                  const isSending = sendingToId === user.uid;
                  return (
                    <div
                      key={user.uid}
                      onClick={() => !isSending && handleForwardToUser(user)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-[#2563EB] transition-colors truncate">
                            {user.displayName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                            @{user.username}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSending}
                        className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 flex-shrink-0"
                      >
                        {isSending ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Icon name="send" size="xs" />
                            <span>Send</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  No additional users found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}

          {filteredConversations.length === 0 && !searchQuery.trim() && (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
              <Icon name="chat" size="lg" className="mb-2 opacity-40" />
              <p className="text-xs">No active conversations found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Search by @username above to forward to any user.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
