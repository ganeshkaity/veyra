"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessage, Conversation, UserProfile } from "@/types";
import { getAllUserStarredMessages, toggleStarMessage } from "@/lib/firestore/conversationService";

interface AllStarredMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  conversations: Conversation[];
  onSelectConversation: (conversationId: string) => void;
}

export const AllStarredMessagesModal: React.FC<AllStarredMessagesModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  conversations,
  onSelectConversation,
}) => {
  const [starredMessages, setStarredMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser.uid) return;

    let isMounted = true;
    setIsLoading(true);

    const convIds = conversations.map((c) => c.id);
    getAllUserStarredMessages(currentUser.uid, convIds)
      .then((msgs) => {
        if (isMounted) {
          setStarredMessages(msgs);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load starred messages:", err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser.uid, conversations]);

  // Unstar a message and remove it from local state
  const handleUnstar = async (e: React.MouseEvent, msg: ChatMessage) => {
    e.stopPropagation();
    try {
      await toggleStarMessage(msg.conversationId, msg.id, currentUser.uid);
      setStarredMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } catch (err) {
      console.error("Failed to unstar message:", err);
    }
  };

  // Helper to get conversation presentation info
  const getConvInfo = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) {
      return {
        title: "Conversation",
        avatar: undefined,
        type: "direct",
      };
    }
    if (conv.type === "group") {
      return {
        title: conv.groupName || "Group Chat",
        avatar: conv.groupAvatar,
        type: "group",
      };
    }
    if (conv.type === "ai") {
      return {
        title: "Veyra AI",
        avatar: "/assets/veyra_ai_logo.png",
        type: "ai",
      };
    }
    const otherId = conv.participantIds.find((id) => id !== currentUser.uid);
    const other = otherId ? conv.participants?.[otherId] : null;
    return {
      title: other?.displayName || "Direct Message",
      avatar: other?.avatarUrl,
      type: "direct",
    };
  };

  // Group messages by conversation ID
  const groupedByConversation = React.useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const msg of starredMessages) {
      const existing = map.get(msg.conversationId) || [];
      existing.push(msg);
      map.set(msg.conversationId, existing);
    }
    return map;
  }, [starredMessages]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Starred Messages" maxWidth="md">
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <span className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Loading starred messages...</span>
          </div>
        ) : starredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-3">
              <Icon name="star" size="md" fill />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No Starred Messages
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Star messages in any chat to easily find them here.
            </p>
          </div>
        ) : (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {Array.from(groupedByConversation.entries()).map(([convId, msgs]) => {
              const info = getConvInfo(convId);
              return (
                <div
                  key={convId}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-3 space-y-2.5"
                >
                  {/* Conversation Header */}
                  <div
                    onClick={() => {
                      onSelectConversation(convId);
                      onClose();
                    }}
                    className="flex items-center justify-between cursor-pointer hover:opacity-85 transition-opacity pb-2 border-b border-slate-200/60 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={info.title} src={info.avatar} size="xs" />
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate block">
                          {info.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {msgs.length} {msgs.length === 1 ? "starred message" : "starred messages"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#2563EB] dark:text-[#38BDF8] font-medium hover:underline flex items-center gap-0.5">
                      Open chat
                      <Icon name="chevron_right" size="xs" />
                    </span>
                  </div>

                  {/* Messages list in this conversation */}
                  <div className="space-y-2">
                    {msgs.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          onSelectConversation(convId);
                          onClose();
                        }}
                        className="group relative p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 shadow-xs hover:border-[#2563EB]/40 dark:hover:border-[#2563EB]/40 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {info.type === "group" && (
                                <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                                  {m.senderName || "Member"}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {new Date(m.createdAt).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                })} • {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {m.text && (
                              <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-3">
                                {m.text}
                              </p>
                            )}

                            {m.mediaUrl && (
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 mt-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                <img
                                  src={m.mediaUrl}
                                  alt="media"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>

                          {/* Unstar button */}
                          <button
                            type="button"
                            onClick={(e) => handleUnstar(e, m)}
                            className="p-1.5 rounded-full text-amber-500 hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex-shrink-0 cursor-pointer"
                            title="Unstar message"
                            aria-label="Unstar message"
                          >
                            <Icon name="star" size="xs" fill />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
