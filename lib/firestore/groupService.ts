import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase/client";
import { GroupDetails, Conversation, UserProfile } from "@/types";
import { sendMessage } from "./conversationService";

// Helper to generate secure, unguessable invite code (e.g. vyg_7a9f2e...)
function generateSafeInviteCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let token = "vyg_";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      token += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 12; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return token;
}

export async function createGroup(
  name: string,
  description: string,
  avatar: string,
  members: UserProfile[],
  currentUser: UserProfile
): Promise<string> {
  const groupsRef = collection(db, "groups");
  const newGroupRef = doc(groupsRef);
  const groupId = newGroupRef.id;
  const now = Date.now();
  const inviteCode = generateSafeInviteCode();

  const allMembers = [currentUser, ...members.filter((m) => m.uid !== currentUser.uid)];
  const memberIds = allMembers.map((m) => m.uid);

  const groupData: GroupDetails = {
    id: groupId,
    name: name.trim(),
    avatar: avatar || "",
    avatarUrl: avatar || "",
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser.uid,
    createdById: currentUser.uid,
    admins: [currentUser.uid],
    adminIds: [currentUser.uid],
    members: memberIds,
    memberIds,
    settings: {
      whoCanAddMembers: "admins",
    },
    inviteCode,
  };

  await setDoc(newGroupRef, groupData);

  // Store safe invite lookup
  try {
    const inviteRef = doc(db, "groupInvites", inviteCode);
    await setDoc(inviteRef, {
      inviteCode,
      groupId,
      name: name.trim(),
      avatar: avatar || "",
      description: description.trim(),
      memberCount: memberIds.length,
      createdBy: currentUser.uid,
      createdAt: now,
    });
  } catch (err) {
    console.warn("Non-fatal: Failed to create group invite doc:", err);
  }

  // Create corresponding conversation
  const convRef = doc(db, "conversations", groupId);
  const participantsRecord: Record<string, { uid: string; displayName: string; username: string; avatarUrl: string }> = {};
  allMembers.forEach((m) => {
    participantsRecord[m.uid] = {
      uid: m.uid,
      displayName: m.displayName,
      username: m.username,
      avatarUrl: m.avatarUrl,
    };
  });

  const conversationData: Omit<Conversation, "id"> = {
    type: "group",
    groupId,
    groupName: name.trim(),
    groupAvatar: avatar || "",
    participantIds: memberIds,
    participants: participantsRecord,
    lastMessage: {
      text: `${currentUser.displayName} created group "${name.trim()}"`,
      senderId: currentUser.uid,
      timestamp: now,
      type: "text",
    },
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(convRef, conversationData);

  // Post system intro message
  try {
    await sendMessage(groupId, {
      conversationId: groupId,
      senderId: currentUser.uid,
      senderName: "Veyra System",
      text: `${currentUser.displayName} created the group "${name.trim()}".`,
      type: "text",
    });
  } catch (err) {
    console.warn("Non-fatal: Failed to post group creation system message:", err);
  }

  return groupId;
}

export function subscribeToUserGroups(
  uid: string,
  onUpdate: (groups: GroupDetails[]) => void
): Unsubscribe {
  const groupsRef = collection(db, "groups");
  // Query both arrays for safety
  const q = query(groupsRef, where("members", "array-contains", uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: GroupDetails[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as GroupDetails;
        list.push({
          ...data,
          id: d.id,
          members: data.members || data.memberIds || [],
          admins: data.admins || data.adminIds || [],
          settings: data.settings || { whoCanAddMembers: "admins" },
        });
      });
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdate(list);
    },
    (err) => {
      console.error("Error subscribing to user groups:", err);
    }
  );
}

export function subscribeToGroup(
  groupId: string,
  onUpdate: (group: GroupDetails | null) => void
): Unsubscribe {
  const groupRef = doc(db, "groups", groupId);
  return onSnapshot(
    groupRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const data = snap.data() as GroupDetails;
      onUpdate({
        ...data,
        id: snap.id,
        members: data.members || data.memberIds || [],
        admins: data.admins || data.adminIds || [],
        settings: data.settings || { whoCanAddMembers: "admins" },
      });
    },
    (err) => {
      console.error("Error subscribing to group:", err);
    }
  );
}

export async function addMemberToGroup(
  groupId: string,
  member: UserProfile,
  requestingUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];
  const settings = groupData.settings || { whoCanAddMembers: "admins" };

  const isAdmin = admins.includes(requestingUser.uid);
  if (!isAdmin && settings.whoCanAddMembers !== "all") {
    throw new Error("Only group admins can add new members.");
  }

  const now = Date.now();

  await updateDoc(groupRef, {
    members: arrayUnion(member.uid),
    memberIds: arrayUnion(member.uid),
    updatedAt: now,
  });

  const convRef = doc(db, "conversations", groupId);
  await updateDoc(convRef, {
    participantIds: arrayUnion(member.uid),
    [`participants.${member.uid}`]: {
      uid: member.uid,
      displayName: member.displayName,
      username: member.username,
      avatarUrl: member.avatarUrl,
    },
    updatedAt: now,
  });

  // Post system message
  try {
    await sendMessage(groupId, {
      conversationId: groupId,
      senderId: requestingUser.uid,
      senderName: "Veyra System",
      text: `${requestingUser.displayName} added ${member.displayName}.`,
      type: "text",
    });
  } catch (err) {
    console.warn("Non-fatal: Failed to send add member message:", err);
  }
}

export async function removeMemberFromGroup(
  groupId: string,
  memberId: string,
  memberName: string,
  requestingUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  const isAdmin = admins.includes(requestingUser.uid);
  if (!isAdmin && requestingUser.uid !== memberId) {
    throw new Error("Only group admins can remove members.");
  }

  const now = Date.now();

  await updateDoc(groupRef, {
    members: arrayRemove(memberId),
    memberIds: arrayRemove(memberId),
    admins: arrayRemove(memberId),
    adminIds: arrayRemove(memberId),
    updatedAt: now,
  });

  const convRef = doc(db, "conversations", groupId);
  await updateDoc(convRef, {
    participantIds: arrayRemove(memberId),
    updatedAt: now,
  });

  // Post system message
  try {
    await sendMessage(groupId, {
      conversationId: groupId,
      senderId: requestingUser.uid,
      senderName: "Veyra System",
      text: `${requestingUser.displayName} removed ${memberName}.`,
      type: "text",
    });
  } catch (err) {
    console.warn("Non-fatal: Failed to send remove member message:", err);
  }
}

export async function promoteAdmin(
  groupId: string,
  memberId: string,
  memberName: string,
  requestingUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  if (!admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins can promote members.");
  }

  const now = Date.now();

  await updateDoc(groupRef, {
    admins: arrayUnion(memberId),
    adminIds: arrayUnion(memberId),
    updatedAt: now,
  });

  try {
    await sendMessage(groupId, {
      conversationId: groupId,
      senderId: requestingUser.uid,
      senderName: "Veyra System",
      text: `${memberName} was made an admin by ${requestingUser.displayName}.`,
      type: "text",
    });
  } catch (err) {
    console.warn("Non-fatal: Failed to send promote admin message:", err);
  }
}

export async function demoteAdmin(
  groupId: string,
  memberId: string,
  memberName: string,
  requestingUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  if (!admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins can demote other admins.");
  }

  // Prevent demoting the group creator
  if (memberId === groupData.createdBy || memberId === groupData.createdById) {
    throw new Error("The group creator cannot be demoted.");
  }

  const now = Date.now();

  await updateDoc(groupRef, {
    admins: arrayRemove(memberId),
    adminIds: arrayRemove(memberId),
    updatedAt: now,
  });

  try {
    await sendMessage(groupId, {
      conversationId: groupId,
      senderId: requestingUser.uid,
      senderName: "Veyra System",
      text: `${memberName} was dismissed as an admin by ${requestingUser.displayName}.`,
      type: "text",
    });
  } catch (err) {
    console.warn("Non-fatal: Failed to send demote admin message:", err);
  }
}

export async function leaveGroup(groupId: string, currentUser: UserProfile): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;

  const groupData = snap.data() as GroupDetails;
  const members = (groupData.members || groupData.memberIds || []).filter((id) => id !== currentUser.uid);
  let admins = (groupData.admins || groupData.adminIds || []).filter((id) => id !== currentUser.uid);

  // If the leaving user was the only admin, automatically promote the first remaining member
  if (admins.length === 0 && members.length > 0) {
    admins = [members[0]];
  }

  const now = Date.now();

  if (members.length === 0) {
    // Delete group if no members left
    await deleteDoc(groupRef);
    if (groupData.inviteCode) {
      try {
        await deleteDoc(doc(db, "groupInvites", groupData.inviteCode));
      } catch (_) {}
    }
  } else {
    await updateDoc(groupRef, {
      members,
      memberIds: members,
      admins,
      adminIds: admins,
      updatedAt: now,
    });
  }

  // Update conversation
  const convRef = doc(db, "conversations", groupId);
  try {
    if (members.length === 0) {
      await deleteDoc(convRef);
    } else {
      await updateDoc(convRef, {
        participantIds: arrayRemove(currentUser.uid),
        updatedAt: now,
      });
      // Post system leave message
      await sendMessage(groupId, {
        conversationId: groupId,
        senderId: currentUser.uid,
        senderName: "Veyra System",
        text: `${currentUser.displayName} left the group.`,
        type: "text",
      });
    }
  } catch (err) {
    console.warn("Non-fatal: Failed to update conversation on leave:", err);
  }
}

export async function deleteGroup(groupId: string, requestingUser: UserProfile): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];
  const isCreator = groupData.createdBy === requestingUser.uid || groupData.createdById === requestingUser.uid;

  if (!isCreator && !admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins or the group creator can delete this group.");
  }

  // Delete invite doc
  if (groupData.inviteCode) {
    try {
      await deleteDoc(doc(db, "groupInvites", groupData.inviteCode));
    } catch (_) {}
  }

  // Delete group doc
  await deleteDoc(groupRef);

  // Delete conversation
  const convRef = doc(db, "conversations", groupId);
  try {
    await deleteDoc(convRef);
  } catch (err) {
    console.warn("Non-fatal: Failed to delete conversation doc:", err);
  }
}

export async function editGroupName(
  groupId: string,
  newName: string,
  requestingUser: UserProfile
): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Group name cannot be empty.");

  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  if (!admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins can edit the group name.");
  }

  const now = Date.now();
  await updateDoc(groupRef, {
    name: trimmed,
    updatedAt: now,
  });

  const convRef = doc(db, "conversations", groupId);
  await updateDoc(convRef, {
    groupName: trimmed,
    updatedAt: now,
  });

  if (groupData.inviteCode) {
    try {
      await updateDoc(doc(db, "groupInvites", groupData.inviteCode), {
        name: trimmed,
      });
    } catch (_) {}
  }

  try {
    await sendMessage(groupId, {
      conversationId: groupId,
      senderId: requestingUser.uid,
      senderName: "Veyra System",
      text: `${requestingUser.displayName} changed the group name to "${trimmed}".`,
      type: "text",
    });
  } catch (_) {}
}

export async function editGroupAvatar(
  groupId: string,
  newAvatar: string,
  requestingUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  if (!admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins can change the group avatar.");
  }

  const now = Date.now();
  await updateDoc(groupRef, {
    avatar: newAvatar,
    avatarUrl: newAvatar,
    updatedAt: now,
  });

  const convRef = doc(db, "conversations", groupId);
  await updateDoc(convRef, {
    groupAvatar: newAvatar,
    updatedAt: now,
  });

  if (groupData.inviteCode) {
    try {
      await updateDoc(doc(db, "groupInvites", groupData.inviteCode), {
        avatar: newAvatar,
      });
    } catch (_) {}
  }
}

export async function editGroupDescription(
  groupId: string,
  newDescription: string,
  requestingUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  if (!admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins can edit the description.");
  }

  const now = Date.now();
  await updateDoc(groupRef, {
    description: newDescription.trim(),
    updatedAt: now,
  });

  if (groupData.inviteCode) {
    try {
      await updateDoc(doc(db, "groupInvites", groupData.inviteCode), {
        description: newDescription.trim(),
      });
    } catch (_) {}
  }
}

export async function updateGroupSettings(
  groupId: string,
  settings: { whoCanAddMembers: "admins" | "all" },
  requestingUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  if (!admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins can change group settings.");
  }

  await updateDoc(groupRef, {
    settings,
    updatedAt: Date.now(),
  });
}

export async function regenerateInviteCode(
  groupId: string,
  requestingUser: UserProfile
): Promise<string> {
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group does not exist.");

  const groupData = snap.data() as GroupDetails;
  const admins = groupData.admins || groupData.adminIds || [];

  if (!admins.includes(requestingUser.uid)) {
    throw new Error("Only group admins can reset the invite link.");
  }

  // Delete previous invite doc
  if (groupData.inviteCode) {
    try {
      await deleteDoc(doc(db, "groupInvites", groupData.inviteCode));
    } catch (_) {}
  }

  const newCode = generateSafeInviteCode();
  const now = Date.now();

  await updateDoc(groupRef, {
    inviteCode: newCode,
    updatedAt: now,
  });

  // Create new invite doc
  const members = groupData.members || groupData.memberIds || [];
  await setDoc(doc(db, "groupInvites", newCode), {
    inviteCode: newCode,
    groupId,
    name: groupData.name,
    avatar: groupData.avatar || groupData.avatarUrl || "",
    description: groupData.description || "",
    memberCount: members.length,
    createdBy: requestingUser.uid,
    createdAt: now,
  });

  return newCode;
}

export interface GroupInvitePreview {
  inviteCode: string;
  groupId: string;
  name: string;
  avatar: string;
  description: string;
  memberCount: number;
}

export async function getGroupByInviteCode(inviteCode: string): Promise<GroupInvitePreview | null> {
  const cleanCode = inviteCode.trim();
  const inviteRef = doc(db, "groupInvites", cleanCode);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) return null;
  return snap.data() as GroupInvitePreview;
}

export async function joinGroupByInviteCode(
  inviteCode: string,
  currentUser: UserProfile
): Promise<string> {
  const preview = await getGroupByInviteCode(inviteCode);
  if (!preview) throw new Error("This invite link is invalid or has been revoked.");

  const groupId = preview.groupId;
  const groupRef = doc(db, "groups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("This group no longer exists.");

  const groupData = snap.data() as GroupDetails;
  const members = groupData.members || groupData.memberIds || [];

  if (members.includes(currentUser.uid)) {
    return groupId; // Already a member!
  }

  const now = Date.now();

  await updateDoc(groupRef, {
    members: arrayUnion(currentUser.uid),
    memberIds: arrayUnion(currentUser.uid),
    updatedAt: now,
  });

  const convRef = doc(db, "conversations", groupId);
  await updateDoc(convRef, {
    participantIds: arrayUnion(currentUser.uid),
    [`participants.${currentUser.uid}`]: {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl,
    },
    updatedAt: now,
  });

  // Post system join message
  try {
    await sendMessage(groupId, {
      conversationId: groupId,
      senderId: currentUser.uid,
      senderName: "Veyra System",
      text: `${currentUser.displayName} joined using an invite link.`,
      type: "text",
    });
  } catch (_) {}

  return groupId;
}
