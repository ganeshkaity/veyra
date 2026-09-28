"use client";

import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface CallLogItem {
  id: string;
  callId?: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  callType: "voice" | "video";
  direction: "incoming" | "outgoing";
  status: "connected" | "missed" | "declined" | "failed";
  duration: number; // in seconds
  timestamp: number;
  conversationId?: string;
}

/**
 * Record a new call log entry for a specific user
 */
export async function recordCallLog(
  userId: string,
  entry: Omit<CallLogItem, "id">
): Promise<string> {
  if (!userId) return "";
  try {
    const logsRef = collection(db, "users", userId, "callLogs");
    const docRef = await addDoc(logsRef, {
      ...entry,
      timestamp: entry.timestamp || Date.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Failed to record call log in Firestore:", error);
    return "";
  }
}

/**
 * Subscribe in real-time to a user's call logs, sorted newest first
 */
export function subscribeToCallLogs(
  userId: string,
  callback: (logs: CallLogItem[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const logsRef = collection(db, "users", userId, "callLogs");
  const q = query(logsRef, orderBy("timestamp", "desc"), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: CallLogItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        logs.push({
          id: d.id,
          callId: data.callId || "",
          partnerId: data.partnerId || "",
          partnerName: data.partnerName || "Unknown",
          partnerAvatar: data.partnerAvatar || "",
          callType: data.callType === "video" ? "video" : "voice",
          direction: data.direction === "outgoing" ? "outgoing" : "incoming",
          status: data.status || "connected",
          duration: typeof data.duration === "number" ? data.duration : 0,
          timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
          conversationId: data.conversationId || "",
        });
      });
      callback(logs);
    },
    (error) => {
      console.error("Error subscribing to call logs:", error);
      callback([]);
    }
  );
}

/**
 * Delete specific call logs by IDs
 */
export async function deleteCallLogs(
  userId: string,
  logIds: string[]
): Promise<void> {
  if (!userId || !logIds.length) return;
  try {
    const batch = writeBatch(db);
    logIds.forEach((id) => {
      const ref = doc(db, "users", userId, "callLogs", id);
      batch.delete(ref);
    });
    await batch.commit();
  } catch (error) {
    console.error("Failed to delete selected call logs:", error);
    throw error;
  }
}

/**
 * Clear all call logs for a user
 */
export async function clearAllCallLogs(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const logsRef = collection(db, "users", userId, "callLogs");
    const snapshot = await getDocs(logsRef);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (error) {
    console.error("Failed to clear all call logs:", error);
    throw error;
  }
}

/**
 * Synchronize past call records from conversation messages into callLogs.
 * This ensures any calls previously made in chat conversations are seamlessly
 * available in the call log without any hardcoding or dummy data.
 */
export async function syncCallLogsFromConversations(
  userId: string,
  userDisplayName?: string
): Promise<void> {
  if (!userId) return;
  try {
    // Check if user already has logs
    const existingRef = collection(db, "users", userId, "callLogs");
    const existingSnap = await getDocs(query(existingRef, limit(1)));
    if (!existingSnap.empty) {
      // User already has real logs in callLogs, no sync needed
      return;
    }

    // Scan user's conversations for call-type messages
    const convsRef = collection(db, "conversations");
    const qConv = query(convsRef, where("participantIds", "array-contains", userId), limit(25));
    const convSnap = await getDocs(qConv);

    if (convSnap.empty) return;

    for (const convDoc of convSnap.docs) {
      const convData = convDoc.data();
      const messagesRef = collection(db, "conversations", convDoc.id, "messages");
      const qMsgs = query(messagesRef, where("type", "==", "call"), limit(50));
      const msgSnap = await getDocs(qMsgs);

      if (!msgSnap.empty) {
        for (const mDoc of msgSnap.docs) {
          const mData = mDoc.data();
          const callInfo = mData.callInfo || {};
          const isOutgoing = mData.senderId === userId;
          
          // Determine partner
          let partnerId = "";
          let partnerName = "Contact";
          let partnerAvatar = "";

          const pIds: string[] = Array.isArray(convData.participantIds)
            ? convData.participantIds
            : Array.isArray(convData.participants)
            ? convData.participants
            : [];

          partnerId = pIds.find((p) => p !== userId) || "";

          if (partnerId && convData.participants && typeof convData.participants === "object" && !Array.isArray(convData.participants)) {
            const pDetails = convData.participants[partnerId];
            if (pDetails) {
              partnerName = pDetails.displayName || pDetails.username || partnerName;
              partnerAvatar = pDetails.avatarUrl || "";
            }
          } else if (callInfo.callerId && callInfo.callerId !== userId) {
            partnerId = callInfo.callerId;
            partnerName = mData.senderName || partnerName;
          }

          await recordCallLog(userId, {
            callId: mDoc.id,
            partnerId,
            partnerName,
            partnerAvatar,
            callType: callInfo.callType === "video" ? "video" : "voice",
            direction: isOutgoing ? "outgoing" : "incoming",
            status: callInfo.status === "missed" ? "missed" : (callInfo.status === "declined" ? "declined" : "connected"),
            duration: typeof callInfo.duration === "number" ? callInfo.duration : 0,
            timestamp: mData.createdAt?.toMillis ? mData.createdAt.toMillis() : (typeof mData.createdAt === "number" ? mData.createdAt : Date.now()),
            conversationId: convDoc.id,
          });
        }
      }
    }
  } catch (err) {
    console.warn("Could not sync past calls from conversations:", err);
  }
}
