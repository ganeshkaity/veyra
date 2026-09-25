"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { searchUsersByUsername, getUserProfile } from "@/lib/firestore/userService";
import { subscribeToConversations } from "@/lib/firestore/conversationService";
import { createGroup } from "@/lib/firestore/groupService";
import { uploadAvatar } from "@/lib/storage/imgbbService";
import { UserProfile, Conversation } from "@/types";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onGroupCreated: (groupId: string) => void;
  conversations?: Conversation[];
}

const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/identicon/svg?seed=Family&backgroundColor=2563eb",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Team&backgroundColor=0d9488",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Friends&backgroundColor=7c3aed",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Project&backgroundColor=ea580c",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Creative&backgroundColor=db2777",
  "https://api.dicebear.com/7.x/identicon/svg?seed=VeyraVibes&backgroundColor=16a34a",
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onGroupCreated,
  conversations: propConversations,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chat contacts loaded from conversations
  const [internalConversations, setInternalConversations] = useState<Conversation[]>([]);
  const [chatUsers, setChatUsers] = useState<UserProfile[]>([]);
  const [isLoadingChatUsers, setIsLoadingChatUsers] = useState(false);

  // Subscribe to user conversations if not passed in props
  useEffect(() => {
    if (!isOpen) return;
    if (propConversations && propConversations.length > 0) return;

    const unsub = subscribeToConversations(
      currentUser.uid,
      (convos) => {
        setInternalConversations(convos);
      },
      (err) => {
        console.error("CreateGroupModal: failed to load conversations", err);
      }
    );
    return () => unsub();
  }, [isOpen, currentUser.uid, propConversations]);

  const activeConversations =
    propConversations && propConversations.length > 0
      ? propConversations
      : internalConversations;

  // Extract unique users from active chat conversations
  useEffect(() => {
    if (!isOpen) return;

    setIsLoadingChatUsers(true);
    const userMap = new Map<string, UserProfile>();

    // Sort conversations by recency
    const sortedConvs = [...activeConversations].sort((a, b) => {
      const timeA = a.lastMessage?.timestamp || a.updatedAt || a.createdAt || 0;
      const timeB = b.lastMessage?.timestamp || b.updatedAt || b.createdAt || 0;
      return timeB - timeA;
    });

    for (const conv of sortedConvs) {
      if (conv.participantIds && Array.isArray(conv.participantIds)) {
        for (const uid of conv.participantIds) {
          if (uid === currentUser.uid) continue;
          if (uid === "veyra-ai" || uid.startsWith("ai_")) continue;

          if (!userMap.has(uid)) {
            const p = conv.participants?.[uid];
            userMap.set(uid, {
              uid,
              displayName: p?.displayName || "User",
              username: p?.username || "",
              avatarUrl: p?.avatarUrl || "",
              bio: "",
              email: "",
              createdAt: 0,
              updatedAt: 0,
              emailVerified: true,
              twoFactorEnabled: false,
              authProviders: [],
            } as UserProfile);
          }
        }
      }
    }

    const initialList = Array.from(userMap.values());
    setChatUsers(initialList);
    setIsLoadingChatUsers(false);

    // Refresh with full Firestore user profiles if available
    const uidsToFetch = initialList.map((u) => u.uid).slice(0, 35);
    if (uidsToFetch.length > 0) {
      Promise.all(uidsToFetch.map((id) => getUserProfile(id)))
        .then((profiles) => {
          const valid = profiles.filter((p): p is UserProfile => p !== null);
          if (valid.length > 0) {
            setChatUsers((prev) =>
              prev.map((oldUser) => {
                const found = valid.find((v) => v.uid === oldUser.uid);
                return found || oldUser;
              })
            );
          }
        })
        .catch((err) => {
          console.warn("Could not enrich chat users with profile data:", err);
        });
    }
  }, [isOpen, activeConversations, currentUser.uid]);

  // Search users: filters current chat users locally and queries Firestore by username
  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    const cleaned = val.trim().replace(/^@+/, "");
    if (!cleaned) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // 1. Instant local match across chat users
    const lower = cleaned.toLowerCase();
    const localMatches = chatUsers.filter((u) => {
      const matchName = u.displayName?.toLowerCase().includes(lower);
      const matchUsername = u.username?.toLowerCase().includes(lower);
      return matchName || matchUsername;
    });

    setIsSearching(true);
    try {
      // 2. Global search in Firestore
      const serverUsers = await searchUsersByUsername(cleaned);

      const combinedMap = new Map<string, UserProfile>();
      localMatches.forEach((u) => {
        if (u.uid !== currentUser.uid) combinedMap.set(u.uid, u);
      });
      serverUsers.forEach((u) => {
        if (u.uid !== currentUser.uid && !combinedMap.has(u.uid)) {
          combinedMap.set(u.uid, u);
        }
      });

      setSearchResults(Array.from(combinedMap.values()));
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults(localMatches);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelectMember = (user: UserProfile) => {
    if (selectedMembers.some((u) => u.uid === user.uid)) {
      setSelectedMembers(selectedMembers.filter((u) => u.uid !== user.uid));
    } else {
      setSelectedMembers([...selectedMembers, user]);
    }
  };

  // Custom image upload handler using imgBB with 100-150 KB high-clarity compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage("Please choose an image under 10MB.");
        return;
      }
      try {
        setIsUploadingAvatar(true);
        setErrorMessage(null);
        const res = await uploadAvatar(file);
        setAvatarUrl(res.url);
      } catch (err: any) {
        console.error("Failed to upload avatar to imgBB:", err);
        setErrorMessage(err.message || "Failed to upload group avatar.");
      } finally {
        setIsUploadingAvatar(false);
        e.target.value = "";
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMessage("Please enter a group name.");
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage(null);
      const groupId = await createGroup(
        groupName.trim(),
        description.trim(),
        avatarUrl,
        selectedMembers,
        currentUser
      );
      onGroupCreated(groupId);
      handleClose();
    } catch (err: any) {
      console.error("Failed to create group:", err);
      setErrorMessage(err.message || "Failed to create group.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setGroupName("");
    setDescription("");
    setAvatarUrl(PRESET_AVATARS[0]);
    setSelectedMembers([]);
    setSearchQuery("");
    setSearchResults([]);
    setErrorMessage(null);
    onClose();
  };

  const isSearchActive = searchQuery.trim().length > 0;
  const displayedUsers = isSearchActive ? searchResults : chatUsers;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? "New Group: Select Members" : "New Group Details"}
      maxWidth="md"
    >
      {step === 1 ? (
        <div className="space-y-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select participants from your chats or search by username to add to your new group.
          </p>

          {/* Selected members chips */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/50 dark:border-slate-700/50 max-h-24 overflow-y-auto">
              {selectedMembers.map((m) => (
                <span
                  key={m.uid}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#2563EB] dark:text-[#14B8A6] text-xs font-semibold"
                >
                  <Avatar name={m.displayName} src={m.avatarUrl} size="xs" />
                  <span className="max-w-[120px] truncate">{m.displayName}</span>
                  <button
                    onClick={() => toggleSelectMember(m)}
                    className="hover:opacity-75 ml-0.5 p-0.5 rounded-full"
                    aria-label={`Remove ${m.displayName}`}
                  >
                    <Icon name="close" size="xs" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <Input
            placeholder="Search users by name or @username..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            leftIcon={<Icon name="person_search" size="sm" />}
            autoFocus
          />

          {/* Section Header */}
          <div className="flex items-center justify-between px-1 pt-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>
              {isSearchActive
                ? "Search Results"
                : `Your Chat Contacts (${chatUsers.length})`}
            </span>
            {isSearchActive && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-[10px] text-[#2563EB] dark:text-[#14B8A6] hover:underline normal-case font-normal"
              >
                Clear search
              </button>
            )}
          </div>

          {/* Member List (Chat users or Search results) */}
          <div className="min-h-[180px] max-h-[260px] overflow-y-auto space-y-1 pr-1">
            {isSearching ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-400 gap-2">
                <span className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                <span>Searching users...</span>
              </div>
            ) : isLoadingChatUsers ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-400 gap-2">
                <span className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                <span>Loading chat contacts...</span>
              </div>
            ) : displayedUsers.length > 0 ? (
              displayedUsers.map((user) => {
                const isSelected = selectedMembers.some((u) => u.uid === user.uid);
                return (
                  <button
                    key={user.uid}
                    type="button"
                    onClick={() => toggleSelectMember(user)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {user.displayName}
                        </h5>
                        {user.username && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            @{user.username}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center ml-2 flex-shrink-0">
                      {isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center text-white shadow-sm transition-transform scale-100">
                          <Icon name="check" size="xs" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center transition-colors hover:border-[#2563EB]" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : isSearchActive ? (
              <div className="text-center py-10 text-xs text-slate-400">
                No users found for "{searchQuery.replace(/^@+/, "")}"
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-slate-400 leading-relaxed px-4">
                No recent chat contacts found.
                <br />
                Type an @username above to search and add members.
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 font-medium">
              {selectedMembers.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(2)}
                disabled={selectedMembers.length === 0}
                rightIcon={<Icon name="arrow_forward" size="xs" />}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Name, Avatar, Description, Create */
        <form onSubmit={handleCreate} className="space-y-4">
          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Group Avatar Preview & Selection */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative group">
              <Avatar
                name={groupName || "Group"}
                src={avatarUrl}
                size="xl"
                className="ring-4 ring-[#2563EB]/20"
              />
              <label
                htmlFor={isUploadingAvatar ? undefined : "group-avatar-upload"}
                className={`absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white ${
                  isUploadingAvatar
                    ? "opacity-100 cursor-wait"
                    : "opacity-0 group-hover:opacity-100 cursor-pointer"
                } transition-opacity text-[10px] font-semibold`}
              >
                {isUploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Icon name="photo_camera" size="sm" />
                    <span>Upload</span>
                  </>
                )}
              </label>
              <input
                id="group-avatar-upload"
                type="file"
                accept="image/*"
                disabled={isUploadingAvatar}
                className="hidden"
                onChange={handleImageFileChange}
              />
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Styles:</span>
              <div className="flex items-center gap-1.5">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-transform ${
                      avatarUrl === url
                        ? "border-[#2563EB] scale-110 shadow-sm"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt="Preset avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Input
            label="Group Name"
            required
            placeholder="e.g. Goa Trip 2026, Core Dev Team"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            leftIcon={<Icon name="groups" size="sm" />}
            autoFocus
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 border border-transparent focus:border-[#2563EB] outline-none resize-none leading-relaxed"
            />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedMembers.length + 1} members ({selectedMembers.length} selected + you as Admin)
          </p>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating}
              disabled={isCreating || isUploadingAvatar}
              leftIcon={<Icon name="check" size="xs" />}
            >
              Create Group
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
