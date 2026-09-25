"use client";

import React, { useState, useEffect } from "react";
import { Conversation, UserProfile, UserPresence, GroupDetails } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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

interface DetailsPanelProps {
  conversation: Conversation;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onGroupDeletedOrLeft?: () => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  conversation,
  currentUser,
  isOpen,
  onClose,
  onGroupDeletedOrLeft,
}) => {
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

  if (!isOpen) return null;

  // Determine admin rights
  const currentGroupAdmins = groupDetails?.admins || groupDetails?.adminIds || [];
  const isCurrentUserAdmin = isGroup && currentGroupAdmins.includes(currentUser.uid);
  const isCurrentUserCreator =
    isGroup &&
    (groupDetails?.createdBy === currentUser.uid || groupDetails?.createdById === currentUser.uid);

  // Member permissions
  const canAddMembers =
    isGroup &&
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
    if (confirm("Reset the invite link? The previous link will stop working.")) {
      try {
        setActionLoading(true);
        await regenerateInviteCode(groupDetails.id, currentUser);
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
    if (confirm(`Remove ${memberName} from this group?`)) {
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
    if (confirm(`Dismiss ${memberName} as an admin?`)) {
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
    if (confirm("Are you sure you want to leave this group?")) {
      try {
        await leaveGroup(groupDetails.id, currentUser);
        onClose();
        onGroupDeletedOrLeft?.();
      } catch (err: any) {
        setActionError(err.message || "Failed to leave group.");
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupDetails) return;
    if (confirm("Are you sure you want to delete this group? This cannot be undone.")) {
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
    name = other?.displayName || "User";
    avatarUrl = other?.avatarUrl || "";
    username = other?.username || "";
    bio = "Hey there! I am using Veyra.";
  }

  // Participants in group
  const participantIds = isGroup
    ? groupDetails?.members || groupDetails?.memberIds || conversation.participantIds
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
      {isGroup && (
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
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Icon name="tune" size="xs" className="text-[#2563EB]" />
            <span>Group Settings</span>
          </h5>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Who can add members
                </span>
                <span className="text-[11px] text-slate-400">
                  {groupDetails?.settings?.whoCanAddMembers === "all"
                    ? "All members can add friends"
                    : "Only admins can add members"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanAddMembers: "admins" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                  groupDetails?.settings?.whoCanAddMembers === "admins"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                }`}
              >
                Admins only
              </button>
              <button
                type="button"
                onClick={() =>
                  groupDetails &&
                  updateGroupSettings(groupDetails.id, { whoCanAddMembers: "all" }, currentUser)
                }
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                  groupDetails?.settings?.whoCanAddMembers === "all"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                }`}
              >
                All members
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

      {/* Danger Zone Actions */}
      <div className="p-4 space-y-1 mt-auto">
        {isGroup ? (
          <>
            <button
              onClick={handleLeaveGroup}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Icon name="logout" size="sm" />
              <span>Leave Group</span>
            </button>

            {(isCurrentUserAdmin || isCurrentUserCreator) && (
              <button
                onClick={handleDeleteGroup}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Icon name="delete_forever" size="sm" />
                <span>Delete Group</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Icon name="notifications_off" size="sm" className="text-slate-400" />
              <span>Mute Notifications</span>
            </button>

            <button className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
              <Icon name="block" size="sm" />
              <span>Block Contact</span>
            </button>
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
    </aside>
  );
};
