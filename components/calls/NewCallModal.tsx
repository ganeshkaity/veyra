"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { UserProfile, Conversation } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { searchUsersByUsername } from "@/lib/firestore/userService";
import { subscribeToConversations } from "@/lib/firestore/conversationService";

interface NewCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onStartCall: (
    targetUser: {
      uid: string;
      displayName: string;
      avatarUrl?: string;
      conversationId?: string;
    },
    callType: "voice" | "video"
  ) => void;
}

interface CallContact {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  username?: string;
  conversationId?: string;
}

export const NewCallModal: React.FC<NewCallModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onStartCall,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const pushedHistoryRef = useRef(false);

  // Trap mobile browser back button so back only closes this modal without refreshing
  useEffect(() => {
    if (!isOpen) {
      pushedHistoryRef.current = false;
      return;
    }

    if (!pushedHistoryRef.current) {
      window.history.pushState({ newCallModal: true }, "");
      pushedHistoryRef.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      // User tapped back
      pushedHistoryRef.current = false;
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, onClose]);

  // Safe close handler that steps back history if modal state was pushed
  const handleSafeClose = () => {
    if (pushedHistoryRef.current && window.history.state?.newCallModal) {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      pushedHistoryRef.current = false;
      onClose();
    }
  };

  // Subscribe to active chats for quick call contacts
  useEffect(() => {
    if (!currentUser?.uid || !isOpen) return;
    const unsub = subscribeToConversations(currentUser.uid, (list) => {
      setConversations(list);
    });
    return () => unsub();
  }, [currentUser?.uid, isOpen]);

  // Extract distinct direct contacts from conversations
  const directContacts: CallContact[] = useMemo(() => {
    if (!currentUser) return [];
    const contactMap = new Map<string, CallContact>();

    conversations.forEach((conv) => {
      if (conv.type === "channel" || conv.type === "ai" || conv.id.startsWith("ai_")) return;

      if (conv.type === "direct") {
        const partnerId = conv.participantIds?.find((p) => p !== currentUser.uid);
        if (partnerId) {
          const details = conv.participants?.[partnerId];
          const name = details?.displayName || details?.username || "Contact";
          contactMap.set(partnerId, {
            uid: partnerId,
            displayName: name,
            avatarUrl: details?.avatarUrl || "",
            username: details?.username || "",
            conversationId: conv.id,
          });
        }
      }
    });

    return Array.from(contactMap.values());
  }, [conversations, currentUser]);

  // Handle user search input
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(trimmed);
        const filtered = results.filter((u) => u.uid !== currentUser?.uid);
        setSearchResults(filtered);
      } catch (err) {
        console.error("Error searching users for call:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.uid]);

  if (!isOpen) return null;

  // Filtered contacts based on search query
  const filteredDirectContacts = directContacts.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.displayName.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
      {/* Container: Fullscreen on mobile, centered card on desktop */}
      <div className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-md bg-white dark:bg-[#0B1120] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border-0 md:border md:border-slate-200/80 md:dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50/90 dark:bg-[#0F172A]/90 border-b border-slate-200/80 dark:border-slate-800">
          <button
            onClick={handleSafeClose}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 active:scale-95 transition-transform"
            aria-label="Back"
          >
            <Icon name="arrow_back" size="md" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              New Call
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a contact to audio or video call
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white dark:bg-[#0B1120] border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Icon name="search" size="sm" className="text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts or @username..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
          {/* Global Search Results if query entered */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Users on Veyra
              </div>
              {searchResults.map((user) => (
                <div
                  key={user.uid}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={user.displayName || "User"}
                      src={user.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        @{user.username || "user"}
                      </p>
                    </div>
                  </div>

                  {/* Call Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        handleSafeClose();
                        onStartCall(
                          {
                            uid: user.uid,
                            displayName: user.displayName || "Contact",
                            avatarUrl: user.avatarUrl,
                          },
                          "voice"
                        );
                      }}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-[#2563EB] dark:text-blue-400 transition-colors active:scale-95"
                      title="Voice Call"
                    >
                      <Icon name="call" size="sm" />
                    </button>
                    <button
                      onClick={() => {
                        handleSafeClose();
                        onStartCall(
                          {
                            uid: user.uid,
                            displayName: user.displayName || "Contact",
                            avatarUrl: user.avatarUrl,
                          },
                          "video"
                        );
                      }}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-[#14B8A6] dark:text-teal-400 transition-colors active:scale-95"
                      title="Video Call"
                    >
                      <Icon name="videocam" size="sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Chats Contacts */}
          <div className="py-2">
            <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {searchQuery.trim() ? "Active Chats" : "Frequently Contacted"}
            </div>

            {filteredDirectContacts.length === 0 && !searchQuery.trim() && (
              <div className="px-6 py-12 text-center text-slate-400">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Icon name="contact_phone" size="md" />
                </div>
                <p className="text-sm font-medium">No active chats found</p>
                <p className="text-xs mt-1 text-slate-400">
                  Use the search bar above to find someone by @username
                </p>
              </div>
            )}

            {filteredDirectContacts.length === 0 && searchQuery.trim() && searchResults.length === 0 && !isSearching && (
              <div className="px-6 py-12 text-center text-slate-400">
                <p className="text-sm font-medium">No matching contacts</p>
                <p className="text-xs mt-1 text-slate-400">
                  Try searching with an exact @username
                </p>
              </div>
            )}

            {filteredDirectContacts.map((contact) => (
              <div
                key={contact.uid}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={contact.displayName}
                    src={contact.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {contact.displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {contact.username ? `@${contact.username}` : "Direct Chat"}
                    </p>
                  </div>
                </div>

                {/* Call Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => {
                      handleSafeClose();
                      onStartCall(
                        {
                          uid: contact.uid,
                          displayName: contact.displayName,
                          avatarUrl: contact.avatarUrl,
                          conversationId: contact.conversationId,
                        },
                        "voice"
                      );
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-[#2563EB] dark:text-blue-400 transition-colors active:scale-95"
                    title="Voice Call"
                  >
                    <Icon name="call" size="sm" />
                  </button>
                  <button
                    onClick={() => {
                      handleSafeClose();
                      onStartCall(
                        {
                          uid: contact.uid,
                          displayName: contact.displayName,
                          avatarUrl: contact.avatarUrl,
                          conversationId: contact.conversationId,
                        },
                        "video"
                      );
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-[#14B8A6] dark:text-teal-400 transition-colors active:scale-95"
                    title="Video Call"
                  >
                    <Icon name="videocam" size="sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
