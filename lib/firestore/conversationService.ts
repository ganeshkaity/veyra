import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/client";
import { Conversation, ChatMessage, UserProfile, ConversationParticipant } from "@/types";

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
      snapshot.forEach((d) => {
        convos.push({ id: d.id, ...d.data() } as Conversation);
      });
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

  const convRef = doc(db, "conversations", convId);
  const existing = await getDoc(convRef);

  if (!existing.exists()) {
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

    const newConv: Omit<Conversation, "id"> = {
      type: "direct",
      participantIds: [currentUser.uid, targetUser.uid],
      participants,
      unreadCount: {
        [currentUser.uid]: 0,
        [targetUser.uid]: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(convRef, cleanFirestoreData(newConv));
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
      batch.update(convRef, {
        [`unreadCount.${uid}`]: newUnread,
      });
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
  if (!conversationId || conversationId.startsWith("conv_veyra_ai") || conversationId.startsWith("ai_")) return;
  try {
    const convRef = doc(db, "conversations", conversationId);
    await updateDoc(convRef, {
      [`unreadCount.${uid}`]: 0,
    });
    // Mark recipient messages as read in the messages subcollection
    await markMessagesAsRead(conversationId, uid);
  } catch (err) {
    console.warn("Failed to mark conversation as read:", err);
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
    mediaQuality?: "sd" | "hd";
    mediaMetadata?: ChatMessage["mediaMetadata"];
    replyTo?: ChatMessage["replyTo"];
    forwarded?: boolean;
  }
): Promise<string> {
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const newMsgRef = doc(messagesRef);
  const now = Date.now();

  const fullMessage: ChatMessage = cleanFirestoreData({
    ...message,
    id: newMsgRef.id,
    createdAt: now,
    updatedAt: now,
    status: "sent",
    isEdited: false,
    edited: false,
    isDeletedForEveryone: false,
    deletedForEveryone: false,
    deletedForUsers: [],
    forwarded: message.forwarded || false,
  });

  await setDoc(newMsgRef, fullMessage);

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
        : message.text;

    if (convSnap.exists()) {
      const convData = convSnap.data() as Conversation;
      const updates: Record<string, any> = {
        lastMessage: {
          text: lastSnippetText,
          senderId: message.senderId,
          timestamp: now,
          type: message.type,
          status: "sent",
        },
        updatedAt: now,
      };

      // Increment unread count for other participants
      (convData.participantIds || []).forEach((pid) => {
        if (pid !== message.senderId) {
          const prev = convData.unreadCount?.[pid] || 0;
          updates[`unreadCount.${pid}`] = prev + 1;
        }
      });

      await updateDoc(convRef, updates);
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
          "lastMessage.text": newText,
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
    if (!deletedFor.includes(uid)) {
      await updateDoc(msgRef, {
        deletedForUsers: [...deletedFor, uid],
        updatedAt: Date.now(),
      });
    }
  }
}
