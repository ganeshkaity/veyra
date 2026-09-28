import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  collectionGroup,
} from "firebase/firestore";
import { db } from "../firebase/client";
import { Conversation, ChatMessage, UserProfile, ConversationParticipant } from "@/types";
import { getVeyraAiConversationId, VEYRA_AI_CONVERSATION_ID } from "../ai/aiService";
import { stripMarkdown } from "../utils/markdownUtils";

export function subscribeToConversations(
  uid: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const convRef = collection(db, "conversations");
  const q = query(
    convRef,
    where("participantIds", "array-contains", uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const convos: Conversation[] = [];
      const localDeleted = getLocalDeletedIds(uid);
      const toRemoveFromLocal: string[] = [];

      snapshot.forEach((d) => {
        const conv = { id: d.id, ...d.data() } as Conversation;
        if (conv.deletedBy?.includes(uid)) {
          return;
        }
        // If it exists in Firestore and is not deletedBy uid, it's an active or recreated chat
        if (localDeleted.includes(conv.id)) {
          toRemoveFromLocal.push(conv.id);
        }
        convos.push(conv);
      });

      if (toRemoveFromLocal.length > 0) {
        const updated = localDeleted.filter((id) => !toRemoveFromLocal.includes(id));
        setLocalDeletedIds(uid, updated);
      }

      // Order conversations by latest activity (lastMessage.timestamp or updatedAt desc)
      convos.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || a.updatedAt || a.createdAt || 0;
        const timeB = b.lastMessage?.timestamp || b.updatedAt || b.createdAt || 0;
        return timeB - timeA;
      });
      onUpdate(convos);
    },
    (err) => {
      console.error("Error subscribing to conversations:", err);
      if (onError) onError(err);
    }
  );
}

export async function createDirectConversation(
  currentUser: UserProfile,
  targetUser: UserProfile
): Promise<string> {
  // Deterministic ID for 1-to-1 conversation to prevent duplicate chats
  const sortedIds = [currentUser.uid, targetUser.uid].sort();
  const convId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

  // Always remove from localDeleted for both users so the newly started chat is immediately visible
  removeLocalDeletedId(currentUser.uid, convId);
  removeLocalDeletedId(targetUser.uid, convId);

  const convRef = doc(db, "conversations", convId);
  const existing = await getDoc(convRef);

  const participants: Record<string, ConversationParticipant> = {
    [currentUser.uid]: {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl,
    },
    [targetUser.uid]: {
      uid: targetUser.uid,
      displayName: targetUser.displayName,
      username: targetUser.username,
      avatarUrl: targetUser.avatarUrl,
    },
  };

  const now = Date.now();

  if (!existing.exists()) {
    const newConv: Omit<Conversation, "id"> = {
      type: "direct",
      participantIds: [currentUser.uid, targetUser.uid],
      participants,
      unreadCount: {
        [currentUser.uid]: 0,
        [targetUser.uid]: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(convRef, cleanFirestoreData(newConv));
  } else {
    const existingData = existing.data() as Conversation;
    const updates: Record<string, any> = {
      updatedAt: now,
      participants,
      participantIds: [currentUser.uid, targetUser.uid],
    };
    if (existingData.deletedBy && existingData.deletedBy.length > 0) {
      updates.deletedBy = existingData.deletedBy.filter(
        (id) => id !== currentUser.uid && id !== targetUser.uid
      );
    }
    await updateDoc(convRef, updates);
  }

  return convId;
}

export async function markSpecificMessagesAsRead(
  conversationId: string,
  messageIds: string[],
  uid: string
): Promise<void> {
  if (
    !conversationId ||
    messageIds.length === 0 ||
    conversationId.startsWith("conv_veyra_ai") ||
    conversationId.startsWith("ai_")
  ) {
    return;
  }

  try {
    const batch = writeBatch(db);
    const now = Date.now();
    messageIds.forEach((msgId) => {
      const msgRef = doc(db, "conversations", conversationId, "messages", msgId);
      batch.update(msgRef, {
        status: "read",
        updatedAt: now,
      });
    });

    // Adjust conversation unread count
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      const data = convSnap.data() as Conversation;
      const currentUnread = data.unreadCount?.[uid] || 0;
      const newUnread = Math.max(0, currentUnread - messageIds.length);
      const convUpdates: Record<string, any> = {
        [`unreadCount.${uid}`]: newUnread,
      };
      if (
        newUnread === 0 &&
        data.lastMessage &&
        data.lastMessage.senderId !== uid &&
        data.lastMessage.status !== "read"
      ) {
        convUpdates["lastMessage.status"] = "read";
      }
      batch.update(convRef, convUpdates);
    }

    await batch.commit();
  } catch (err) {
    console.warn("Non-fatal: Failed to mark specific messages as read:", err);
  }
}

export async function markMessagesAsRead(
  conversationId: string,
  currentUid: string
): Promise<void> {
  if (!conversationId || conversationId.startsWith("conv_veyra_ai") || conversationId.startsWith("ai_")) return;
  try {
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    // Find unread messages from other participants
    const q = query(
      messagesRef,
      where("status", "in", ["sent", "delivered"]),
      limit(50)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      let count = 0;
      const now = Date.now();
      snap.forEach((docSnap) => {
        const data = docSnap.data() as ChatMessage;
        if (data.senderId !== currentUid) {
          batch.update(docSnap.ref, {
            status: "read",
            updatedAt: now,
          });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn("Non-fatal: Failed to mark messages as read:", err);
  }
}

export async function markMessagesAsDelivered(
  conversationId: string,
  currentUid: string
): Promise<void> {
  if (!conversationId || conversationId.startsWith("conv_veyra_ai") || conversationId.startsWith("ai_")) return;
  try {
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const q = query(
      messagesRef,
      where("status", "==", "sent"),
      limit(50)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      let count = 0;
      const now = Date.now();
      snap.forEach((docSnap) => {
        const data = docSnap.data() as ChatMessage;
        if (data.senderId !== currentUid) {
          batch.update(docSnap.ref, {
            status: "delivered",
            updatedAt: now,
          });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn("Non-fatal: Failed to mark messages as delivered:", err);
  }
}

export async function markConversationAsRead(
  conversationId: string,
  uid: string
): Promise<void> {
  if (!conversationId || !uid) return;
  const resolvedConvId =
    conversationId === VEYRA_AI_CONVERSATION_ID || conversationId.startsWith("conv_veyra_ai")
      ? getVeyraAiConversationId(uid)
      : conversationId;
  try {
    const convRef = doc(db, "conversations", resolvedConvId);
    let convData: Conversation | null = null;
    try {
      const snap = await getDoc(convRef);
      if (snap.exists()) {
        convData = snap.data() as Conversation;
      }
    } catch (_) {}

    const updates: Record<string, any> = {
      [`unreadCount.${uid}`]: 0,
      updatedAt: Date.now(),
    };
    if (convData?.lastMessage && convData.lastMessage.senderId !== uid && convData.lastMessage.status !== "read") {
      updates["lastMessage.status"] = "read";
    }

    try {
      await updateDoc(convRef, updates);
    } catch (_) {
      await setDoc(
        convRef,
        {
          unreadCount: {
            ...(convData?.unreadCount || {}),
            [uid]: 0,
          },
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    // Mark recipient messages as read in the messages subcollection
    if (!resolvedConvId.startsWith("ai_") && !resolvedConvId.startsWith("conv_veyra_ai")) {
      await markMessagesAsRead(resolvedConvId, uid);
    }
  } catch (err) {
    console.warn("Failed to mark conversation as read:", err);
  }
}

export async function markConversationAsUnread(
  conversationId: string,
  uid: string
): Promise<void> {
  if (!conversationId || !uid) return;
  const resolvedConvId =
    conversationId === VEYRA_AI_CONVERSATION_ID || conversationId.startsWith("conv_veyra_ai")
      ? getVeyraAiConversationId(uid)
      : conversationId;
  try {
    const convRef = doc(db, "conversations", resolvedConvId);
    try {
      await updateDoc(convRef, {
        [`unreadCount.${uid}`]: 1,
        updatedAt: Date.now(),
      });
    } catch (_) {
      await setDoc(
        convRef,
        {
          unreadCount: { [uid]: 1 },
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("Failed to mark conversation as unread:", err);
  }
}

export function subscribeToMessages(
  conversationId: string,
  messageLimit: number = 30,
  onUpdate: (messages: ChatMessage[], hasMore: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "desc"), limit(messageLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      const hasMore = snapshot.docs.length >= messageLimit;
      // Return in chronological order (oldest first, newest last)
      onUpdate(msgs.reverse(), hasMore);
    },
    (err) => {
      console.error("Error subscribing to messages:", err);
      if (onError) onError(err);
    }
  );
}

function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result[key] = cleanFirestoreData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export async function sendMessage(
  conversationId: string,
  message: {
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    text: string;
    type: ChatMessage["type"];
    mediaUrl?: string;
    mediaUrls?: string[];
    mediaQuality?: "sd" | "hd";
    mediaMetadata?: ChatMessage["mediaMetadata"];
    replyTo?: ChatMessage["replyTo"];
    forwarded?: boolean;
    reactions?: ChatMessage["reactions"];
    callInfo?: ChatMessage["callInfo"];
  }
): Promise<string> {
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const newMsgRef = doc(messagesRef);
  const now = Date.now();

  const isSystemMessage =
    message.type === "system" ||
    message.senderId === "system" ||
    message.senderName === "Veyra System";

  const fullMessage: ChatMessage = cleanFirestoreData({
    ...message,
    id: newMsgRef.id,
    createdAt: now,
    updatedAt: now,
    status: isSystemMessage ? "read" : "sent",
    isEdited: false,
    edited: false,
    isDeletedForEveryone: false,
    deletedForEveryone: false,
    deletedForUsers: [],
    forwarded: message.forwarded || false,
  });

  await setDoc(newMsgRef, fullMessage);

  // Un-delete conversation locally for sender so it's guaranteed visible in chat list
  removeLocalDeletedId(message.senderId, conversationId);

  // Update conversation last message snippet and recipient unreadCount
  const convRef = doc(db, "conversations", conversationId);
  try {
    const convSnap = await getDoc(convRef);
    const lastSnippetText =
      message.type === "image"
        ? "📷 Photo"
        : message.type === "gif"
        ? "👾 GIF"
        : message.type === "sticker"
        ? `${message.text} Sticker`
        : message.type === "call"
        ? `${message.callInfo?.callType === "video" ? "📹 Video call" : "📞 Voice call"} • ${message.callInfo?.subtitle || "No answer"}`
        : stripMarkdown(message.text);

    if (convSnap.exists()) {
      const convData = convSnap.data() as Conversation;
      const updates: Record<string, any> = {
        lastMessage: {
          text: lastSnippetText,
          senderId: message.senderId,
          timestamp: now,
          type: message.type,
          status: isSystemMessage ? "read" : "sent",
        },
        updatedAt: now,
      };

      // Increment unread count for other participants ONLY if not a system message
      if (!isSystemMessage) {
        (convData.participantIds || []).forEach((pid) => {
          if (pid !== message.senderId) {
            const prev = convData.unreadCount?.[pid] || 0;
            updates[`unreadCount.${pid}`] = prev + 1;
          }
        });
      }

      // If conversation was deleted by participants, restore it on new activity
      if (convData.deletedBy && convData.deletedBy.length > 0) {
        updates.deletedBy = [];
      }

      await updateDoc(convRef, updates);
    } else {
      // If doc didn't exist yet (e.g. AI conversation), initialize it cleanly with lastMessage
      await setDoc(
        convRef,
        {
          id: conversationId,
          participantIds: conversationId.startsWith("ai_")
            ? [message.senderId, "veyra_ai"]
            : [message.senderId],
          type: conversationId.startsWith("ai_") ? "ai" : "direct",
          lastMessage: {
            text: lastSnippetText,
            senderId: message.senderId,
            timestamp: now,
            type: message.type,
            status: "sent",
          },
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("Non-fatal: Failed to update conversation snippet:", err);
  }

  return newMsgRef.id;
}

export async function forwardMessage(
  targetConversationId: string,
  originalMessage: ChatMessage,
  sender: UserProfile
): Promise<string> {
  return sendMessage(targetConversationId, {
    conversationId: targetConversationId,
    senderId: sender.uid,
    senderName: sender.displayName,
    senderAvatar: sender.avatarUrl,
    text: originalMessage.text,
    type: originalMessage.type,
    mediaUrl: originalMessage.mediaUrl,
    mediaQuality: originalMessage.mediaQuality,
    mediaMetadata: originalMessage.mediaMetadata,
    forwarded: true,
  });
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) {
    throw new Error("Message not found.");
  }
  const data = snap.data() as ChatMessage;
  const now = Date.now();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

  if (now - data.createdAt > TWO_DAYS_MS) {
    throw new Error("Messages can only be edited within 2 days of sending.");
  }
  if (data.isDeletedForEveryone || data.deletedForEveryone) {
    throw new Error("Cannot edit a deleted message.");
  }

  await updateDoc(msgRef, {
    text: newText,
    isEdited: true,
    edited: true,
    editedAt: now,
    updatedAt: now,
  });

  // Update conversation lastMessage snippet if this was the latest message
  try {
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      const convData = convSnap.data() as Conversation;
      if (convData.lastMessage && convData.lastMessage.timestamp === data.createdAt) {
        await updateDoc(convRef, {
          "lastMessage.text": stripMarkdown(newText),
          updatedAt: now,
        });
      }
    }
  } catch (err) {
    console.warn("Non-fatal: Failed to update conversation snippet on edit:", err);
  }
}

export async function deleteMessageForEveryone(
  conversationId: string,
  messageId: string
): Promise<void> {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) {
    throw new Error("Message not found.");
  }
  const data = snap.data() as ChatMessage;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (now - data.createdAt > ONE_DAY_MS) {
    throw new Error("Messages can only be deleted for everyone within 24 hours.");
  }

  const exactDeletionText = "Oh, the message was deleted";

  await updateDoc(msgRef, {
    text: exactDeletionText,
    isDeletedForEveryone: true,
    deletedForEveryone: true,
    mediaUrl: null,
    updatedAt: now,
  });

  // Update conversation lastMessage snippet if this was the latest message
  try {
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      const convData = convSnap.data() as Conversation;
      if (convData.lastMessage && convData.lastMessage.timestamp === data.createdAt) {
        await updateDoc(convRef, {
          "lastMessage.text": exactDeletionText,
          updatedAt: now,
        });
      }
    }
  } catch (err) {
    console.warn("Non-fatal: Failed to update conversation snippet on delete:", err);
  }
}

export async function deleteMessageForMe(
  conversationId: string,
  messageId: string,
  uid: string
): Promise<void> {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(msgRef);
  if (snap.exists()) {
    const data = snap.data() as ChatMessage;
    const deletedFor = data.deletedForUsers || [];
    const isUnreadFromOther = data.senderId !== uid && data.status !== "read";
    if (!deletedFor.includes(uid)) {
      const msgUpdates: Record<string, any> = {
        deletedForUsers: [...deletedFor, uid],
        updatedAt: Date.now(),
      };
      if (isUnreadFromOther) {
        msgUpdates.status = "read";
      }
      await updateDoc(msgRef, msgUpdates);

      if (isUnreadFromOther) {
        try {
          const convRef = doc(db, "conversations", conversationId);
          const convSnap = await getDoc(convRef);
          if (convSnap.exists()) {
            const convData = convSnap.data() as Conversation;
            const currentUnread = convData.unreadCount?.[uid] || 0;
            if (currentUnread > 0) {
              await updateDoc(convRef, {
                [`unreadCount.${uid}`]: Math.max(0, currentUnread - 1),
                updatedAt: Date.now(),
              });
            }
          }
        } catch (e) {
          console.warn("Failed to update unreadCount on deleteMessageForMe:", e);
        }
      }
    }
  }
}

/**
 * Toggle starred status of a message for a specific user
 */
export async function toggleStarMessage(
  conversationId: string,
  messageId: string,
  uid: string
): Promise<boolean> {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return false;
  const data = snap.data() as ChatMessage;
  const starredBy = data.starredBy || [];
  const isStarred = starredBy.includes(uid);
  if (isStarred) {
    await updateDoc(msgRef, {
      starredBy: arrayRemove(uid),
      updatedAt: Date.now(),
    });
    return false;
  } else {
    await updateDoc(msgRef, {
      starredBy: arrayUnion(uid),
      updatedAt: Date.now(),
    });
    return true;
  }
}

/**
 * Star or unstar multiple messages at once
 */
export async function starMultipleMessages(
  conversationId: string,
  messageIds: string[],
  uid: string,
  star: boolean
): Promise<void> {
  if (!messageIds || messageIds.length === 0) return;
  const batch = writeBatch(db);
  for (const mId of messageIds) {
    const msgRef = doc(db, "conversations", conversationId, "messages", mId);
    batch.update(msgRef, {
      starredBy: star ? arrayUnion(uid) : arrayRemove(uid),
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
}

/**
 * Permanently delete multiple messages from db (for conversation selection deletion)
 */
export async function deleteMultipleMessages(
  conversationId: string,
  messageIds: string[]
): Promise<void> {
  if (!messageIds || messageIds.length === 0) return;
  const batch = writeBatch(db);
  for (const mId of messageIds) {
    const msgRef = doc(db, "conversations", conversationId, "messages", mId);
    batch.delete(msgRef);
  }
  await batch.commit();
}

/**
 * Retrieve all starred messages for a user across conversations
 */
export async function getAllUserStarredMessages(
  uid: string,
  conversationIds: string[]
): Promise<ChatMessage[]> {
  if (!uid) return [];
  try {
    // Try collectionGroup query first
    const q = query(
      collectionGroup(db, "messages"),
      where("starredBy", "array-contains", uid)
    );
    const snap = await getDocs(q);
    const msgs: ChatMessage[] = [];
    snap.forEach((d) => {
      const data = { id: d.id, ...d.data() } as ChatMessage;
      if (!data.deletedForUsers?.includes(uid)) {
        msgs.push(data);
      }
    });
    if (msgs.length > 0) {
      return msgs.sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch (err) {
    console.warn("collectionGroup query for starred messages failed, falling back to per-conversation lookup:", err);
  }

  // Fallback: Query messages subcollection of each conversation
  const results: ChatMessage[] = [];
  const targetIds = conversationIds && conversationIds.length > 0 ? conversationIds : [];

  await Promise.all(
    targetIds.map(async (cId) => {
      try {
        const q = query(
          collection(db, "conversations", cId, "messages"),
          where("starredBy", "array-contains", uid)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = { id: d.id, ...d.data() } as ChatMessage;
          if (!data.deletedForUsers?.includes(uid)) {
            results.push(data);
          }
        });
      } catch (e) {
        // ignore per-conversation errors
      }
    })
  );

  return results.sort((a, b) => b.createdAt - a.createdAt);
}

// LocalStorage fallback & cache for instant optimistic updates
export function getLocalArchivedIds(uid: string): string[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = localStorage.getItem(`veyra_archived_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalArchivedIds(uid: string, ids: string[]): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(`veyra_archived_${uid}`, JSON.stringify(ids));
  } catch {}
}

export function getLocalUnarchivedIds(uid: string): string[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = localStorage.getItem(`veyra_unarchived_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalUnarchivedIds(uid: string, ids: string[]): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(`veyra_unarchived_${uid}`, JSON.stringify(ids));
  } catch {}
}

export function isConversationArchived(conv: Conversation, uid: string): boolean {
  if (!uid || !conv) return false;
  // If explicitly unarchived by user in this session/browser, override any stale snapshot
  const unarchivedList = getLocalUnarchivedIds(uid);
  if (unarchivedList.includes(conv.id)) return false;

  const localList = getLocalArchivedIds(uid);
  if (localList.includes(conv.id)) return true;

  return Boolean(conv.archivedBy && conv.archivedBy.includes(uid));
}

export async function archiveConversation(conversationId: string, uid: string): Promise<void> {
  // Remove from unarchived set
  const unarchived = getLocalUnarchivedIds(uid);
  setLocalUnarchivedIds(uid, unarchived.filter((id) => id !== conversationId));

  // Add to archived set
  const current = getLocalArchivedIds(uid);
  if (!current.includes(conversationId)) {
    setLocalArchivedIds(uid, [...current, conversationId]);
  }

  try {
    const convRef = doc(db, "conversations", conversationId);
    await updateDoc(convRef, {
      archivedBy: arrayUnion(uid),
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn("Non-fatal: could not sync archive status to Firestore:", err);
  }
}

export async function unarchiveConversation(conversationId: string, uid: string): Promise<void> {
  // Remove from archived set
  const current = getLocalArchivedIds(uid);
  setLocalArchivedIds(uid, current.filter((id) => id !== conversationId));

  // Mark as explicitly unarchived so it immediately disappears from Archived view
  const unarchived = getLocalUnarchivedIds(uid);
  if (!unarchived.includes(conversationId)) {
    setLocalUnarchivedIds(uid, [...unarchived, conversationId]);
  }

  try {
    const convRef = doc(db, "conversations", conversationId);
    await updateDoc(convRef, {
      archivedBy: arrayRemove(uid),
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn("Non-fatal: could not sync unarchive status to Firestore:", err);
  }
}

// ---------------- PINNED CHATS (MAX 4 PER SECTION) ----------------

export function getLocalPinnedIds(uid: string): string[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = localStorage.getItem(`veyra_pinned_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalPinnedIds(uid: string, ids: string[]): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(`veyra_pinned_${uid}`, JSON.stringify(ids));
  } catch {}
}

export function getLocalArchivedPinnedIds(uid: string): string[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = localStorage.getItem(`veyra_archived_pinned_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalArchivedPinnedIds(uid: string, ids: string[]): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(`veyra_archived_pinned_${uid}`, JSON.stringify(ids));
  } catch {}
}

export function isConversationPinned(
  conv: Conversation,
  uid: string,
  isArchive: boolean = false
): boolean {
  if (!uid || !conv) return false;
  if (isArchive) {
    const list = getLocalArchivedPinnedIds(uid);
    return list.includes(conv.id);
  }
  const list = getLocalPinnedIds(uid);
  if (list.includes(conv.id)) return true;
  return Boolean(conv.pinnedBy && conv.pinnedBy.includes(uid));
}

export async function pinConversation(
  conversationId: string,
  uid: string,
  isArchive: boolean = false
): Promise<{ success: boolean; message?: string }> {
  if (isArchive) {
    const current = getLocalArchivedPinnedIds(uid);
    if (current.includes(conversationId)) return { success: true };
    if (current.length >= 4) {
      return { success: false, message: "You can only pin up to 4 chats in archived" };
    }
    setLocalArchivedPinnedIds(uid, [conversationId, ...current]);
    return { success: true };
  }

  const current = getLocalPinnedIds(uid);
  if (current.includes(conversationId)) return { success: true };
  if (current.length >= 4) {
    return { success: false, message: "You can only pin up to 4 chats" };
  }
  setLocalPinnedIds(uid, [conversationId, ...current]);

  try {
    const convRef = doc(db, "conversations", conversationId);
    await updateDoc(convRef, {
      pinnedBy: arrayUnion(uid),
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn("Non-fatal: could not sync pin to Firestore:", err);
  }

  return { success: true };
}

export async function unpinConversation(
  conversationId: string,
  uid: string,
  isArchive: boolean = false
): Promise<void> {
  if (isArchive) {
    const current = getLocalArchivedPinnedIds(uid);
    setLocalArchivedPinnedIds(uid, current.filter((id) => id !== conversationId));
    return;
  }

  const current = getLocalPinnedIds(uid);
  setLocalPinnedIds(uid, current.filter((id) => id !== conversationId));

  try {
    const convRef = doc(db, "conversations", conversationId);
    await updateDoc(convRef, {
      pinnedBy: arrayRemove(uid),
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn("Non-fatal: could not sync unpin to Firestore:", err);
  }
}

// ---------------- DELETED & CLEARED CHATS ----------------

export function getLocalDeletedIds(uid: string): string[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = localStorage.getItem(`veyra_deleted_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalDeletedIds(uid: string, ids: string[]): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(`veyra_deleted_${uid}`, JSON.stringify(ids));
  } catch {}
}

export function removeLocalDeletedId(uid: string, convId: string): void {
  if (typeof window === "undefined" || !uid || !convId) return;
  try {
    const local = getLocalDeletedIds(uid);
    if (local.includes(convId)) {
      setLocalDeletedIds(
        uid,
        local.filter((id) => id !== convId)
      );
    }
  } catch {}
}

export function isConversationDeleted(conv: Conversation, uid: string): boolean {
  if (!uid || !conv) return false;
  return Boolean(conv.deletedBy && conv.deletedBy.includes(uid));
}

async function clearConversationMessagesInBatch(
  conversationId: string,
  uid: string,
  deleteStarred: boolean = false
): Promise<void> {
  try {
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    while (true) {
      const snap = await getDocs(query(messagesRef, limit(400)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      let deletedCount = 0;
      snap.forEach((d) => {
        const data = d.data() as ChatMessage;
        const isStarred = data.starredBy?.includes(uid);
        if (!deleteStarred && isStarred) {
          return;
        }
        batch.delete(d.ref);
        deletedCount++;
      });
      if (deletedCount > 0) {
        await batch.commit();
      }
      if (deletedCount === 0 || snap.docs.length < 400) break;
    }
  } catch (err) {
    console.warn("Non-fatal: could not batch clear messages:", err);
  }
}

export async function deleteAllConversationMessagesFromDb(
  conversationId: string
): Promise<void> {
  if (!conversationId) return;
  try {
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    while (true) {
      const snap = await getDocs(query(messagesRef, limit(400)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      if (snap.docs.length < 400) break;
    }
  } catch (err) {
    console.warn("Could not completely delete messages for:", conversationId, err);
  }
}

export async function deleteConversation(
  conversationId: string,
  uid: string
): Promise<void> {
  if (!conversationId) return;

  const resolvedConvId =
    conversationId === VEYRA_AI_CONVERSATION_ID || conversationId.startsWith("conv_veyra_ai")
      ? (uid ? getVeyraAiConversationId(uid) : conversationId)
      : conversationId;

  // 1. Instant optimistic local cache update
  if (uid) {
    const current = getLocalDeletedIds(uid);
    if (!current.includes(resolvedConvId)) {
      setLocalDeletedIds(uid, [...current, resolvedConvId]);
    }
    if (!current.includes(conversationId)) {
      setLocalDeletedIds(uid, [...current, conversationId]);
    }
    const pinned = getLocalPinnedIds(uid);
    if (pinned.includes(resolvedConvId)) {
      setLocalPinnedIds(uid, pinned.filter((id) => id !== resolvedConvId));
    }
    const archived = getLocalArchivedIds(uid);
    if (archived.includes(resolvedConvId)) {
      setLocalArchivedIds(uid, archived.filter((id) => id !== resolvedConvId));
    }
  }

  // 2. If this conversation is a group, check if there are other members remaining
  let isGroupWithRemainingMembers = false;
  try {
    const groupRef = doc(db, "groups", resolvedConvId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data();
      const otherMembers = (gData.members || gData.memberIds || []).filter((id: string) => id !== uid);
      if (otherMembers.length > 0) {
        isGroupWithRemainingMembers = true;
      }
    }
  } catch (_) {}

  if (isGroupWithRemainingMembers) {
    // Only remove this user from the conversation and group doc, do not destroy the group or delete messages for others!
    try {
      const convRef = doc(db, "conversations", resolvedConvId);
      await updateDoc(convRef, {
        participantIds: arrayRemove(uid),
        deletedBy: arrayUnion(uid),
        leftParticipantIds: arrayRemove(uid),
        updatedAt: Date.now(),
      });
    } catch (_) {}

    try {
      const groupRef = doc(db, "groups", resolvedConvId);
      await updateDoc(groupRef, {
        members: arrayRemove(uid),
        memberIds: arrayRemove(uid),
        leftMemberIds: arrayRemove(uid),
        admins: arrayRemove(uid),
        adminIds: arrayRemove(uid),
        updatedAt: Date.now(),
      });
    } catch (_) {}

    // Clean up user references in users/{uid}
    if (uid) {
      try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
          lockedConversationIds: arrayRemove(resolvedConvId, conversationId),
          favoriteConversationIds: arrayRemove(resolvedConvId, conversationId),
        });
      } catch (_) {}
    }
    return;
  }

  // 3. Entirely delete all messages from subcollection in Firestore
  await deleteAllConversationMessagesFromDb(resolvedConvId);
  if (conversationId !== resolvedConvId) {
    await deleteAllConversationMessagesFromDb(conversationId);
  }

  // 4. Entirely delete the conversation document from Firestore
  try {
    const convRef = doc(db, "conversations", resolvedConvId);
    await deleteDoc(convRef);
  } catch (err) {
    console.warn("Non-fatal: could not delete conversation doc from Firestore:", err);
  }

  if (conversationId !== resolvedConvId) {
    try {
      const altRef = doc(db, "conversations", conversationId);
      await deleteDoc(altRef);
    } catch (_) {}
  }

  // 5. If this conversation was a group, delete the group doc and any invite code doc
  try {
    const groupRef = doc(db, "groups", resolvedConvId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data();
      if (gData?.inviteCode) {
        try {
          await deleteDoc(doc(db, "groupInvites", gData.inviteCode));
        } catch (_) {}
      }
      await deleteDoc(groupRef);
    }
  } catch (_) {}

  // 5. Clean up user references in users/{uid} (locked chats, favourites)
  if (uid) {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        lockedConversationIds: arrayRemove(resolvedConvId, conversationId),
        favoriteConversationIds: arrayRemove(resolvedConvId, conversationId),
      });
    } catch (_) {}
  }
}

export async function clearConversation(
  conversationId: string,
  uid: string,
  deleteStarred: boolean = false
): Promise<void> {
  if (!conversationId || !uid) return;

  const resolvedConvId =
    conversationId === VEYRA_AI_CONVERSATION_ID || conversationId.startsWith("conv_veyra_ai")
      ? getVeyraAiConversationId(uid)
      : conversationId;

  const now = Date.now();
  // 1. Sync clearedAt timestamp to Firestore with setDoc merge
  try {
    const convRef = doc(db, "conversations", resolvedConvId);
    await setDoc(
      convRef,
      {
        [`clearedAt.${uid}`]: now,
        [`unreadCount.${uid}`]: 0,
        lastMessage: null,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Non-fatal: could not update clearedAt in Firestore:", err);
  }

  // 2. Batch permanently delete messages from Firestore db
  await clearConversationMessagesInBatch(resolvedConvId, uid, deleteStarred);
}

export async function deleteMultipleConversations(
  conversationIds: string[],
  uid: string
): Promise<void> {
  await Promise.allSettled(conversationIds.map((id) => deleteConversation(id, uid)));
}

export async function clearMultipleConversations(
  conversationIds: string[],
  uid: string,
  deleteStarred = false
): Promise<void> {
  await Promise.allSettled(conversationIds.map((id) => clearConversation(id, uid, deleteStarred)));
}

/**
 * React to a message with an emoji (or unreact if same emoji is tapped again)
 */
export async function toggleMessageReaction(
  conversationId: string,
  messageId: string,
  user: UserProfile,
  emoji: string
): Promise<void> {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const msgData = snap.data() as ChatMessage;
  const reactions = { ...(msgData.reactions || {}) };

  if (reactions[user.uid]?.emoji === emoji) {
    delete reactions[user.uid];
  } else {
    reactions[user.uid] = {
      emoji,
      userId: user.uid,
      userName: user.displayName || "User",
      userAvatar: user.avatarUrl || "",
      timestamp: Date.now(),
    };
  }

  await updateDoc(msgRef, {
    reactions,
    updatedAt: Date.now(),
  });
}
