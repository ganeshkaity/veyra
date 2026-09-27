"use client";

import React, { useState, useEffect } from "react";
import { Conversation, UserProfile, UserPresence, GroupDetails } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAlert } from "@/components/providers/AlertModalProvider";
import { subscribeToUserPresence, formatLastSeen } from "@/lib/realtime/presenceService";
import {
  subscribeToGroup,
  removeMemberFromGroup,
  promoteAdmin,
  demoteAdmin,
  leaveGroup,
  deleteGroup,
  editGroupName,
  editGroupAvatar,
  editGroupDescription,
  updateGroupSettings,
  regenerateInviteCode,
} from "@/lib/firestore/groupService";
import { uploadAvatar } from "@/lib/storage/imgbbService";
import { AddGroupMemberModal } from "@/components/groups/AddGroupMemberModal";
import { clearConversation, deleteConversation } from "@/lib/firestore/conversationService";
import {
  isConversationFavourite,
  toggleConversationFavourite,
  getEffectiveChatLists,
  toggleConversationList,
} from "@/lib/firestore/chatLockAndListService";
import { getUserProfile } from "@/lib/firestore/userService";
import { ChatMessage } from "@/types";

interface DetailsPanelProps {
  conversation: Conversation;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onGroupDeletedOrLeft?: () => void;
  messages?: ChatMessage[];
  onOpenImageViewer?: (message: ChatMessage) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  conversation,
  currentUser,
  isOpen,
  onClose,
  onGroupDeletedOrLeft,
  messages = [],
  onOpenImageViewer,
}) => {
  const { showConfirm, showAlert } = useAlert();
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  // Edit Modals
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [editNameText, setEditNameText] = useState("");
  const [isEditDescOpen, setIsEditDescOpen] = useState(false);
  const [editDescText, setEditDescText] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // New WhatsApp style options state
  const [isFavourite, setIsFavourite] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showChangeListModal, setShowChangeListModal] = useState(false);
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const [alsoDeleteStarred, setAlsoDeleteStarred] = useState(false);

  useEffect(() => {
    setIsFavourite(isConversationFavourite(conversation.id, currentUser));
  }, [conversation.id, currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Selected member menu
  const [activeMemberMenuUid, setActiveMemberMenuUid] = useState<string | null>(null);

  const isGroup = conversation.type === "group";
  const isAi = conversation.type === "ai";
  const otherId = conversation.participantIds.find((id) => id !== currentUser.uid);

  // Subscribe to group details if it's a group
  useEffect(() => {
    if (!isOpen || !isGroup) {
      setGroupDetails(null);
      return;
    }
    const unsub = subscribeToGroup(conversation.id, (g) => {
      setGroupDetails(g);
      if (g) {
        setEditNameText(g.name);
        setEditDescText(g.description || "");
      }
    });
    return () => unsub();
  }, [isOpen, isGroup, conversation.id]);

  // Subscribe to user presence for 1-to-1 chats
  useEffect(() => {
    if (!isOpen || isGroup || isAi || !otherId) {
      setPresence(null);
      return;
    }
    const unsub = subscribeToUserPresence(otherId, (p) => setPresence(p));
    return () => unsub();
  }, [isOpen, isGroup, isAi, otherId]);

  // Fetch full user profile from DB for 1-to-1 chats so description/bio is real
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (!isOpen || isGroup || isAi || !otherId) {
      setOtherUserProfile(null);
      return;
    }
    let isCancelled = false;
    getUserProfile(otherId).then((p) => {
      if (!isCancelled && p) {
        setOtherUserProfile(p);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, isGroup, isAi, otherId]);

  if (!isOpen) return null;

  // Determine admin rights and membership
  const currentGroupMembers = groupDetails?.members || groupDetails?.memberIds || [];
  const isNoLongerMember =
    isGroup &&
    ((groupDetails !== null && !currentGroupMembers.includes(currentUser.uid)) ||
      Boolean(conversation.leftParticipantIds?.includes(currentUser.uid)));
  const currentGroupAdmins = groupDetails?.admins || groupDetails?.adminIds || [];
  const isCurrentUserAdmin = isGroup && !isNoLongerMember && currentGroupAdmins.includes(currentUser.uid);
  const isCurrentUserCreator =
    isGroup &&
    !isNoLongerMember &&
    (groupDetails?.createdBy === currentUser.uid || groupDetails?.createdById === currentUser.uid);

  // Member permissions
  const canAddMembers =
    isGroup &&
    !isNoLongerMember &&
    (isCurrentUserAdmin || groupDetails?.settings?.whoCanAddMembers === "all");

  // Copy safe invite link
  const inviteLink = groupDetails?.inviteCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://veyra.chat"}/invite/${groupDetails.inviteCode}`
    : "";

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch (_) {}
  };

  const handleResetInvite = async () => {
    if (!groupDetails) return;
    const confirmed = await showConfirm(
      "Reset the invite link? The previous link will stop working.",
      { title: "Reset Invite Link", type: "warning", confirmText: "Reset Link" }
    );
    if (confirmed) {
      try {
        setActionLoading(true);
        await regenerateInviteCode(groupDetails.id, currentUser);
        await showAlert("Invite link has been reset successfully.", { type: "success" });
      } catch (err: any) {
        setActionError(err.message || "Failed to reset invite link.");
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Group Info Edits
  const handleSaveGroupName = async () => {
    if (!groupDetails || !editNameText.trim()) return;
    try {
      setActionLoading(true);
      await editGroupName(groupDetails.id, editNameText.trim(), currentUser);
      setIsEditNameOpen(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to edit group name.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveGroupDesc = async () => {
    if (!groupDetails) return;
    try {
      setActionLoading(true);
      await editGroupDescription(groupDetails.id, editDescText.trim(), currentUser);
      setIsEditDescOpen(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to edit group description.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && groupDetails) {
      if (file.size > 10 * 1024 * 1024) {
        setActionError("Image must be under 10MB.");
        return;
      }
      try {
        setIsUploadingAvatar(true);
        setActionError(null);
        const res = await uploadAvatar(file);
        await editGroupAvatar(groupDetails.id, res.url, currentUser);
      } catch (err: any) {
        console.error("Failed to update group avatar:", err);
        setActionError(err.message || "Failed to update group avatar.");
      } finally {
        setIsUploadingAvatar(false);
        e.target.value = "";
      }
    }
  };

  // Member management
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!groupDetails) return;
    const confirmed = await showConfirm(`Remove ${memberName} from this group?`, {
      title: "Remove Member",
      type: "warning",
      confirmText: "Remove",
    });
    if (confirmed) {
      try {
        await removeMemberFromGroup(groupDetails.id, memberId, memberName, currentUser);
        setActiveMemberMenuUid(null);
      } catch (err: any) {
        setActionError(err.message || "Failed to remove member.");
      }
    }
  };

  const handlePromoteAdmin = async (memberId: string, memberName: string) => {
    if (!groupDetails) return;
    try {
      await promoteAdmin(groupDetails.id, memberId, memberName, currentUser);
      setActiveMemberMenuUid(null);
    } catch (err: any) {
      setActionError(err.message || "Failed to promote admin.");
    }
  };

  const handleDemoteAdmin = async (memberId: string, memberName: string) => {
    if (!groupDetails) return;
    const confirmed = await showConfirm(`Dismiss ${memberName} as an admin?`, {
      title: "Dismiss Admin",
      type: "warning",
      confirmText: "Dismiss",
    });
    if (confirmed) {
      try {
        await demoteAdmin(groupDetails.id, memberId, memberName, currentUser);
        setActiveMemberMenuUid(null);
      } catch (err: any) {
        setActionError(err.message || "Failed to dismiss admin.");
      }
    }
  };

  // Leave & Delete group
  const handleLeaveGroup = async () => {
    if (!groupDetails) return;
    const confirmed = await showConfirm("Are you sure you want to leave this group?", {
      title: "Leave Group",
      type: "warning",
      confirmText: "Leave",
    });
    if (confirmed) {
      try {
        await leaveGroup(groupDetails.id, currentUser);
        onClose();
      } catch (err: any) {
        setActionError(err.message || "Failed to leave group.");
      }
    }
  };

  const handleDeleteGroupForMe = async () => {
    const confirmed = await showConfirm("Are you sure you want to delete this group? This cannot be undone.", {
      title: "Delete Group",
      type: "error",
      confirmText: "Delete",
    });
    if (confirmed) {
      try {
        await deleteConversation(conversation.id, currentUser.uid);
        onClose();
        onGroupDeletedOrLeft?.();
      } catch (err: any) {
        setActionError(err.message || "Failed to delete group.");
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupDetails) return;
    const confirmed = await showConfirm("Are you sure you want to delete this group? This cannot be undone.", {
      title: "Delete Group",
      type: "error",
      confirmText: "Delete",
    });
    if (confirmed) {
      try {
        await deleteGroup(groupDetails.id, currentUser);
        onClose();
        onGroupDeletedOrLeft?.();
      } catch (err: any) {
        setActionError(err.message || "Failed to delete group.");
      }
    }
  };

  // Details content for 1-to-1 or AI
  let name = "";
  let avatarUrl = "";
  let username = "";
  let bio = "";

  if (isGroup) {
    name = groupDetails?.name || conversation.groupName || "Group";
    avatarUrl = groupDetails?.avatar || groupDetails?.avatarUrl || conversation.groupAvatar || "";
    bio = groupDetails?.description || "No description set.";
  } else if (isAi) {
    name = "Veyra AI";
    avatarUrl = "/assets/veyra_ai_logo.png";
    username = "veyra_ai";
    bio =
      "Your friendly AI companion on Veyra — ask questions, brainstorm ideas, learn something new, or just have a chat.";
  } else {
    const other = otherId ? conversation.participants[otherId] : null;
    name = otherUserProfile?.displayName || other?.displayName || "User";
    avatarUrl = otherUserProfile?.avatarUrl || other?.avatarUrl || "";
    username = otherUserProfile?.username || other?.username || "";
    bio = otherUserProfile?.bio || (other as any)?.bio || "Hey there! I am using Veyra.";
  }

  // Participants in group
  const participantIds = isGroup
    ? groupDetails?.members || groupDetails?.memberIds || conversation.participantIds.filter((id) => !conversation.leftParticipantIds?.includes(id))
    : [];

  return (
    <aside className="fixed inset-0 z-50 md:static md:w-80 lg:w-96 md:h-full bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-y-auto animate-in slide-in-from-right-4 duration-200 flex-shrink-0">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Back"
            className="md:hidden p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 mr-1 transition-colors"
          >
            <Icon name="arrow_back" size="sm" />
          </button>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {isGroup ? "Group Info" : "Contact Info"}
          </h4>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="hidden md:flex p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 mx-4 mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="flex flex-col items-center p-6 text-center border-b border-slate-100 dark:border-slate-800 relative">
        <div className="relative group mb-3">
          <Avatar
            name={name}
            src={avatarUrl}
            size="xl"
            isOnline={isAi ? true : isGroup ? undefined : presence?.isOnline}
            className="shadow-md"
          />
          {isGroup && isCurrentUserAdmin && (
            <label
              htmlFor={isUploadingAvatar ? undefined : "group-avatar-details-upload"}
              className={`absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white ${
                isUploadingAvatar
                  ? "opacity-100 cursor-wait"
                  : "opacity-0 group-hover:opacity-100 cursor-pointer"
              } transition-opacity text-[10px] font-semibold`}
              title="Change group avatar"
            >
              {isUploadingAvatar ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Icon name="photo_camera" size="sm" />
                  <span>Change</span>
                </>
              )}
            </label>
          )}
          {isGroup && isCurrentUserAdmin && (
            <input
              id="group-avatar-details-upload"
              type="file"
              accept="image/*"
              disabled={isUploadingAvatar}
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          )}
        </div>

        {/* Group Name + Edit */}
        <div className="flex items-center gap-1.5 justify-center max-w-full px-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
            {name}
          </h3>
          {isGroup && isCurrentUserAdmin && (
            <button
              onClick={() => setIsEditNameOpen(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Edit group name"
            >
              <Icon name="edit" size="xs" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Username or Group Member Count */}
        {username ? (
          <p className="text-xs font-mono text-[#2563EB] dark:text-[#14B8A6] mt-0.5">
            @{username}
          </p>
        ) : isGroup ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Group • {participantIds.length} members
          </p>
        ) : (
          <p
            className={`text-xs mt-1 font-medium ${
              presence?.isOnline ? "text-emerald-500 font-semibold" : "text-slate-400"
            }`}
          >
            {formatLastSeen(presence)}
          </p>
        )}

        {/* Group Description + Edit */}
        <div className="mt-3 px-4 max-w-full w-full">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-left relative group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Description
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {bio}
            </p>
            {isGroup && isCurrentUserAdmin && (
              <button
                onClick={() => setIsEditDescOpen(true)}
                className="absolute top-2 right-2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-80 group-hover:opacity-100 transition-opacity"
                title="Edit description"
              >
                <Icon name="edit" size="xs" className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* GROUP SECTION: Safe Invite Mechanism */}
      {isGroup && !isNoLongerMember && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Icon name="link" size="xs" className="text-[#2563EB]" />
              <span>Group Invite Link</span>
            </span>
            {isCurrentUserAdmin && (
              <button
                disabled={actionLoading}
                onClick={handleResetInvite}
                className="text-[11px] text-red-500 hover:underline"
              >
                Reset link
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 bg-transparent text-xs text-slate-600 dark:text-slate-300 outline-none select-all font-mono truncate"
            />
            <button
              onClick={handleCopyInvite}
              className="px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 transition-colors"
            >
              <Icon name={copiedInvite ? "check" : "content_copy"} size="xs" />
              <span>{copiedInvite ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Anyone on Veyra with this link can view the group preview and join.
          </p>
        </div>
      )}

      {/* GROUP SECTION: Group Settings (Admins Only) */}
      {isGroup && isCurrentUserAdmin && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Icon name="tune" size="xs" className="text-[#2563EB]" />
            <span>Group Settings</span>
          </h5>

          {/* Option 1: Who can add members */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Who can add members
                </span>
                <span className="text-[11px] text-slate-400">
                  {groupDetails?.settings?.whoCanAddMembers === "all"
                    ? "All members can add other members"
                    : "Only admins can add members"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanAddMembers: "all" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  groupDetails?.settings?.whoCanAddMembers === "all"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                All members
              </button>
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanAddMembers: "admins" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  (groupDetails?.settings?.whoCanAddMembers ?? "admins") === "admins"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Admins only
              </button>
            </div>
          </div>

          {/* Option 2: Who can send messages */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Who can send messages
                </span>
                <span className="text-[11px] text-slate-400">
                  {groupDetails?.settings?.whoCanSendMessages === "admins"
                    ? "Only admins can send messages"
                    : "All members can send messages"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanSendMessages: "all" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  (groupDetails?.settings?.whoCanSendMessages ?? "all") === "all"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                All members
              </button>
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanSendMessages: "admins" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  groupDetails?.settings?.whoCanSendMessages === "admins"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Admins only
              </button>
            </div>
          </div>

          {/* Option 3: Who can edit group info */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Who can edit group info
                </span>
                <span className="text-[11px] text-slate-400">
                  {groupDetails?.settings?.whoCanEditGroupInfo === "all"
                    ? "All members can edit name, icon and description"
                    : "Only admins can edit name, icon and description"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanEditGroupInfo: "all" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  groupDetails?.settings?.whoCanEditGroupInfo === "all"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                All members
              </button>
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanEditGroupInfo: "admins" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  (groupDetails?.settings?.whoCanEditGroupInfo ?? "admins") === "admins"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Admins only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP SECTION: Members List */}
      {isGroup && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Icon name="group" size="xs" className="text-[#2563EB]" />
              <span>Members ({participantIds.length})</span>
            </span>

            {canAddMembers && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="text-xs font-semibold text-[#2563EB] dark:text-[#14B8A6] hover:underline flex items-center gap-1"
              >
                <Icon name="person_add" size="xs" />
                <span>Add Members</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-72 overflow-y-auto pr-1">
            {participantIds.map((uid) => {
              const participant = conversation.participants[uid];
              const isCreator =
                groupDetails?.createdBy === uid || groupDetails?.createdById === uid;
              const isAdmin = currentGroupAdmins.includes(uid);
              const isMe = uid === currentUser.uid;
              const showMenu = activeMemberMenuUid === uid;

              return (
                <div
                  key={uid}
                  className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl relative transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={participant?.displayName || "Member"}
                      src={participant?.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {isMe ? "You" : participant?.displayName || "Member"}
                        </span>
                        {isCreator && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            Creator
                          </span>
                        )}
                        {!isCreator && isAdmin && (
                          <span className="px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            Admin
                          </span>
                        )}
                      </div>
                      {participant?.username && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          @{participant.username}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Admin options menu for other members */}
                  {isCurrentUserAdmin && !isMe && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMemberMenuUid(showMenu ? null : uid)
                        }
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10"
                        title="Member options"
                      >
                        <Icon name="more_vert" size="xs" />
                      </button>

                      {showMenu && (
                        <div className="absolute right-0 top-7 z-30 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-xs animate-in fade-in zoom-in-95">
                          {!isAdmin && (
                            <button
                              onClick={() =>
                                handlePromoteAdmin(
                                  uid,
                                  participant?.displayName || "Member"
                                )
                              }
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              <Icon name="shield" size="xs" />
                              <span>Make group admin</span>
                            </button>
                          )}

                          {isAdmin && !isCreator && (
                            <button
                              onClick={() =>
                                handleDemoteAdmin(
                                  uid,
                                  participant?.displayName || "Member"
                                )
                              }
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              <Icon name="remove_moderator" size="xs" />
                              <span>Dismiss as admin</span>
                            </button>
                          )}

                          {!isCreator && (
                            <button
                              onClick={() =>
                                handleRemoveMember(
                                  uid,
                                  participant?.displayName || "Member"
                                )
                              }
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800"
                            >
                              <Icon name="person_remove" size="xs" />
                              <span>Remove from group</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Image 1: WhatsApp Contact Details Options */}
      {(() => {
        const clearedAt = conversation.clearedAt?.[currentUser.uid] || 0;
        const mediaMessages = messages.filter((m) => {
          if (clearedAt > 0 && m.createdAt <= clearedAt) return false;
          if (m.deletedForUsers?.includes(currentUser.uid)) return false;
          return m.type === "image" || Boolean(m.mediaUrl);
        });

        const starredMessages = messages.filter((m) => {
          if (clearedAt > 0 && m.createdAt <= clearedAt) return false;
          if (m.deletedForUsers?.includes(currentUser.uid)) return false;
          return m.starredBy?.includes(currentUser.uid);
        });

        const handleExportChat = () => {
          const visibleMsgs = messages.filter((m) => {
            if (clearedAt > 0 && m.createdAt <= clearedAt) return false;
            if (m.deletedForUsers?.includes(currentUser.uid)) return false;
            return true;
          });

          if (!visibleMsgs || visibleMsgs.length === 0) {
            showToast("No messages to export.");
            return;
          }
          const lines = visibleMsgs.map((m) => {
            const time = new Date(m.createdAt).toLocaleString();
            const sender = m.senderName || (m.senderId === currentUser.uid ? "You" : name);
            const content = m.text || (m.mediaUrl ? `[Media: ${m.mediaUrl}]` : `[${m.type}]`);
            return `[${time}] ${sender}: ${content}`;
          });
          const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Chat_with_${name.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast("Chat exported successfully 📄");
        };

        const handleClearChatConfirm = () => {
          setAlsoDeleteStarred(false);
          setShowClearChatModal(true);
        };

        const handleDeleteChatConfirm = async () => {
          const confirmed = await showConfirm(
            "Are you sure you want to delete this chat?",
            { title: "Delete chat?", type: "error", confirmText: "Delete chat" }
          );
          if (confirmed) {
            try {
              await deleteConversation(conversation.id, currentUser.uid);
              onClose();
              onGroupDeletedOrLeft?.();
            } catch (err: any) {
              showAlert(err.message || "Failed to delete chat", { type: "error" });
            }
          }
        };

        return (
          <div className="border-t border-slate-100 dark:border-slate-800 text-sm">
            {/* 1. Media, links and docs */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <button
                onClick={() => setShowMediaModal(true)}
                className="w-full flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <Icon name="photo_library" size="md" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white" />
                  <span className="font-medium text-slate-800 dark:text-slate-100 text-[14px]">
                    Media, links and docs
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                  {mediaMessages.length}
                </span>
              </button>

              {/* Thumbnails preview */}
              {mediaMessages.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {mediaMessages.slice(0, 4).map((m, i) => (
                    <div
                      key={m.id || i}
                      onClick={() => onOpenImageViewer?.(m)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer hover:opacity-90 relative group border border-slate-200/50 dark:border-slate-700/50"
                    >
                      <img
                        src={m.mediaUrl}
                        alt="media preview"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Starred messages */}
            <div className="py-1">
              <button
                onClick={() => setShowStarredModal(true)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <Icon name="star" size="md" className="text-slate-500 dark:text-slate-400 group-hover:text-amber-500 transition-colors" />
                  <span className="font-medium text-[14px] text-slate-800 dark:text-slate-200">
                    Starred messages
                  </span>
                </div>
                {starredMessages.length > 0 && (
                  <span className="text-xs font-semibold text-slate-400">
                    {starredMessages.length}
                  </span>
                )}
              </button>

              {/* 3. Disappearing messages */}
              <button
                onClick={() => showToast("Disappearing messages: Off")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <Icon name="timelapse" size="md" className="text-slate-500 dark:text-slate-400" />
                  <div>
                    <span className="font-medium text-[14px] text-slate-800 dark:text-slate-200 block leading-tight">
                      Disappearing messages
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">Off</span>
                  </div>
                </div>
              </button>

              {/* 4. Advanced chat privacy */}
              <button
                onClick={() => showToast("Advanced chat privacy: Off")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <Icon name="shield" size="md" className="text-slate-500 dark:text-slate-400" />
                  <div>
                    <span className="font-medium text-[14px] text-slate-800 dark:text-slate-200 block leading-tight">
                      Advanced chat privacy
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">Off</span>
                  </div>
                </div>
              </button>

              {/* 5. Encryption */}
              <button
                onClick={() => setShowEncryptionModal(true)}
                className="w-full px-4 py-3 flex items-start gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
              >
                <Icon name="lock" size="md" className="text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-[14px] text-slate-800 dark:text-slate-200 block leading-tight">
                    Encryption
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5 leading-relaxed">
                    Messages are end-to-end encrypted. Click to verify.
                  </span>
                </div>
              </button>
            </div>

            {/* Divider */}
            <hr className="my-2 border-slate-100 dark:border-slate-800" />

            {/* 6. Add/Remove from favourites & 7. Change list & 8. Export chat */}
            <div className="py-1">
              {!isAi && (
                <>
                  <button
                    onClick={async () => {
                      const res = await toggleConversationFavourite(
                        currentUser.uid,
                        conversation.id,
                        currentUser
                      );
                      setIsFavourite(res.isFavourite);
                      showToast(res.isFavourite ? "Added to favourites ❤️" : "Removed from favourites");
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors group"
                  >
                    <Icon
                      name={isFavourite ? "favorite" : "favorite_border"}
                      size="md"
                      className={
                        isFavourite
                          ? "text-rose-500"
                          : "text-slate-500 dark:text-slate-400 group-hover:text-rose-500"
                      }
                    />
                    <span className="font-medium text-[14px] text-slate-800 dark:text-slate-200">
                      {isFavourite ? "Remove from favourites" : "Add to favourites"}
                    </span>
                  </button>

                  {/* 7. Change list */}
                  <button
                    onClick={() => setShowChangeListModal(true)}
                    className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors group"
                  >
                    <Icon name="folder" size="md" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white" />
                    <span className="font-medium text-[14px] text-slate-800 dark:text-slate-200">
                      Change list
                    </span>
                  </button>
                </>
              )}

              {/* 8. Export chat */}
              <button
                onClick={handleExportChat}
                className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors group"
              >
                <Icon name="download" size="md" className="text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white" />
                <span className="font-medium text-[14px] text-slate-800 dark:text-slate-200">
                  Export chat
                </span>
              </button>
            </div>

            {/* Divider */}
            <hr className="my-2 border-slate-100 dark:border-slate-800" />

            {/* 9. Clear chat & 10. Delete chat (Red actions matching Image 1) */}
            <div className="py-1">
              <button
                onClick={handleClearChatConfirm}
                className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-red-50/50 dark:hover:bg-red-950/20 text-left text-red-600 dark:text-red-400 transition-colors"
              >
                <Icon name="remove_circle_outline" size="md" className="text-red-600 dark:text-red-400" />
                <span className="font-medium text-[14px]">
                  Clear chat
                </span>
              </button>

              {!isAi && (
                <button
                  onClick={handleDeleteChatConfirm}
                  className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-red-50/50 dark:hover:bg-red-950/20 text-left text-red-600 dark:text-red-400 transition-colors"
                >
                  <Icon name="delete" size="md" className="text-red-600 dark:text-red-400" />
                  <span className="font-medium text-[14px]">
                    Delete chat
                  </span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Danger Zone Actions */}
      <div className="p-4 space-y-1 mt-auto">
        {isGroup ? (
          <>
            {isNoLongerMember ? (
              <button
                onClick={handleDeleteGroupForMe}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <Icon name="delete" size="sm" />
                <span>Delete Group</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleLeaveGroup}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  <Icon name="logout" size="sm" />
                  <span>Leave Group</span>
                </button>

                {(isCurrentUserAdmin || isCurrentUserCreator) && (
                  <button
                    onClick={handleDeleteGroup}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <Icon name="delete_forever" size="sm" />
                    <span>Delete Group</span>
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <button className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Icon name="notifications_off" size="sm" className="text-slate-400" />
              <span>Mute Notifications</span>
            </button>

            {!isAi && (
              <button className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                <Icon name="block" size="sm" />
                <span>Block Contact</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Add Member Modal */}
      {groupDetails && (
        <AddGroupMemberModal
          isOpen={isAddMemberOpen}
          onClose={() => setIsAddMemberOpen(false)}
          group={groupDetails}
          currentUser={currentUser}
        />
      )}

      {/* Edit Group Name Modal */}
      <Modal
        isOpen={isEditNameOpen}
        onClose={() => setIsEditNameOpen(false)}
        title="Edit Group Name"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <Input
            value={editNameText}
            onChange={(e) => setEditNameText(e.target.value)}
            placeholder="Group name..."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditNameOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              onClick={handleSaveGroupName}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Group Description Modal */}
      <Modal
        isOpen={isEditDescOpen}
        onClose={() => setIsEditDescOpen(false)}
        title="Edit Group Description"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <textarea
            rows={3}
            value={editDescText}
            onChange={(e) => setEditDescText(e.target.value)}
            placeholder="Add group description..."
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none border border-transparent focus:border-[#2563EB] resize-none leading-relaxed"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditDescOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              onClick={handleSaveGroupDesc}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Encryption Verification Modal */}
      <Modal
        isOpen={showEncryptionModal}
        onClose={() => setShowEncryptionModal(false)}
        title="Verify security code"
        maxWidth="sm"
      >
        <div className="space-y-4 py-2 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Icon name="lock" size="lg" />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Messages and calls with <span className="font-semibold text-slate-900 dark:text-white">{name}</span> are protected with end-to-end encryption. Not even Veyra can read or listen to them.
          </p>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-xs tracking-widest text-slate-700 dark:text-slate-200">
            64829 19482 04817 99283 18492 84018
          </div>
          <p className="text-[11px] text-slate-400">
            To verify that encryption is end-to-end, compare this number with the one on your contact&apos;s device.
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setShowEncryptionModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Media, Links and Docs Modal */}
      <Modal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        title="Media, links and docs"
        maxWidth="md"
      >
        <div className="space-y-4">
          {(() => {
            const clearedAt = conversation.clearedAt?.[currentUser.uid] || 0;
            const mediaList = messages.filter((m) => {
              if (clearedAt > 0 && m.createdAt <= clearedAt) return false;
              if (m.deletedForUsers?.includes(currentUser.uid)) return false;
              return m.type === "image" || Boolean(m.mediaUrl);
            });
            if (mediaList.length === 0) {
              return (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No media, links, or documents shared yet.
                </div>
              );
            }
            return (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {mediaList.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setShowMediaModal(false);
                      onOpenImageViewer?.(m);
                    }}
                    className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer hover:opacity-90 relative group border border-slate-200/50 dark:border-slate-700/50"
                  >
                    <img
                      src={m.mediaUrl}
                      alt="shared media"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowMediaModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Starred Messages Modal */}
      <Modal
        isOpen={showStarredModal}
        onClose={() => setShowStarredModal(false)}
        title="Starred messages"
        maxWidth="md"
      >
        <div className="space-y-3">
          {(() => {
            const clearedAt = conversation.clearedAt?.[currentUser.uid] || 0;
            const starredList = messages.filter((m) => {
              if (clearedAt > 0 && m.createdAt <= clearedAt) return false;
              if (m.deletedForUsers?.includes(currentUser.uid)) return false;
              return m.starredBy?.includes(currentUser.uid);
            });

            if (starredList.length === 0) {
              return (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Icon name="star_border" size="lg" className="text-slate-300 dark:text-slate-600" />
                  <span>No starred messages in this chat yet.</span>
                </div>
              );
            }

            return (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {starredList.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {m.senderName || (m.senderId === currentUser.uid ? "You" : name)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Icon name="star" size="xs" className="text-amber-500 fill-amber-500" />
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    {m.text && (
                      <p className="text-xs text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
                        {m.text}
                      </p>
                    )}
                    {m.mediaUrl && (
                      <div
                        onClick={() => {
                          setShowStarredModal(false);
                          onOpenImageViewer?.(m);
                        }}
                        className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 cursor-pointer"
                      >
                        <img src={m.mediaUrl} alt="starred media" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowStarredModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change List Modal */}
      <Modal
        isOpen={showChangeListModal}
        onClose={() => setShowChangeListModal(false)}
        title="Add to list"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select lists to categorize this conversation:
          </p>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
            {getEffectiveChatLists(currentUser)
              .filter((l) => l.id !== "all" && l.id !== "unread" && l.id !== "groups")
              .map((list) => {
                const isMember =
                  list.id === "favourites"
                    ? isConversationFavourite(conversation.id, currentUser)
                    : Boolean(currentUser.conversationListMemberships?.[conversation.id]?.includes(list.id));
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={async () => {
                      await toggleConversationList(currentUser.uid, conversation.id, list.id, currentUser);
                      if (list.id === "favourites") {
                        setIsFavourite(!isMember);
                      }
                      showToast(`Updated "${list.label}"`);
                    }}
                    className="w-full py-2.5 px-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Icon name={list.id === "favourites" ? "star" : "label"} size="xs" />
                      </div>
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-100">
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
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setShowChangeListModal(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear Chat Confirmation Modal with "Also delete starred messages" checkbox */}
      <Modal
        isOpen={showClearChatModal}
        onClose={() => setShowClearChatModal(false)}
        title="Clear this chat?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Messages will be permanently deleted from this conversation.
          </p>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoDeleteStarred}
              onChange={(e) => setAlsoDeleteStarred(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Also delete starred messages
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowClearChatModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                setShowClearChatModal(false);
                try {
                  await clearConversation(conversation.id, currentUser.uid, alsoDeleteStarred);
                  showToast("Chat cleared successfully");
                } catch (err: any) {
                  showAlert(err.message || "Failed to clear chat", { type: "error" });
                }
              }}
            >
              Clear chat
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}
    </aside>
  );
};
