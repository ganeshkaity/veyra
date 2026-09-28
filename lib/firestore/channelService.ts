import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  Unsubscribe,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { db } from "../firebase/client";
import { Channel, Conversation, UserProfile } from "@/types";



/**
 * Cleans up and deletes any legacy precoded system channels from Firestore
 */
export async function cleanupPrecodedChannels(): Promise<void> {
  try {
    const channelsRef = collection(db, "channels");
    const snap = await getDocs(query(channelsRef, where("createdBy", "==", "system")));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
      try {
        await deleteDoc(doc(db, "conversations", d.id));
      } catch (_) {}
    }
  } catch (err) {
    console.warn("Non-fatal: cleanupPrecodedChannels error:", err);
  }
}

/**
 * Legacy seeding removed - now acts as a cleanup to purge any precoded channels
 */
export async function seedInitialChannelsIfEmpty(): Promise<void> {
  await cleanupPrecodedChannels();
}

/**
 * Subscribes to all real user-created channels (up to limitCount) for the explore page
 */
export function subscribeToAllChannels(
  callback: (channels: Channel[]) => void,
  limitCount: number = 50
): Unsubscribe {
  const channelsRef = collection(db, "channels");
  const q = query(channelsRef, limit(limitCount + 20));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Channel[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        // Remove and exclude any precoded / system channels
        if (data.createdBy !== "system") {
          list.push({ id: d.id, ...data } as Channel);
        }
      });
      // Sort by followerCount desc
      list.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
      callback(list.slice(0, limitCount));
    },
    (err) => {
      console.error("subscribeToAllChannels error:", err);
      callback([]);
    }
  );
}

/**
 * Subscribes to channels followed by the current user
 */
export function subscribeToUserFollowedChannels(
  userId: string,
  callback: (channels: Channel[]) => void
): Unsubscribe {
  const channelsRef = collection(db, "channels");
  const q = query(channelsRef, where("followers", "array-contains", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Channel[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.createdBy !== "system") {
          list.push({ id: d.id, ...data } as Channel);
        }
      });
      callback(list);
    },
    (err) => {
      console.error("subscribeToUserFollowedChannels error:", err);
      callback([]);
    }
  );
}

/**
 * Subscribes to channels created by the current user
 */
export function subscribeToUserCreatedChannels(
  userId: string,
  callback: (channels: Channel[]) => void
): Unsubscribe {
  const channelsRef = collection(db, "channels");
  const q = query(channelsRef, where("createdBy", "==", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Channel[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Channel);
      });
      callback(list);
    },
    (err) => {
      console.error("subscribeToUserCreatedChannels error:", err);
      callback([]);
    }
  );
}

/**
 * Fetches a single channel by ID
 */
export async function getChannelById(channelId: string): Promise<Channel | null> {
  try {
    const docRef = doc(db, "channels", channelId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Channel;
  } catch (err) {
    console.error("getChannelById error:", err);
    return null;
  }
}

/**
 * Realtime subscription to a single channel
 */
export function subscribeToChannel(
  channelId: string,
  callback: (channel: Channel | null) => void
): Unsubscribe {
  const docRef = doc(db, "channels", channelId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback({ id: snap.id, ...snap.data() } as Channel);
      }
    },
    (err) => {
      console.error("subscribeToChannel error:", err);
      callback(null);
    }
  );
}

/**
 * Creates a brand new channel and its corresponding conversation
 */
export async function createChannel(
  name: string,
  description: string,
  avatarUrl: string,
  currentUser: UserProfile
): Promise<Channel> {
  const channelsRef = collection(db, "channels");
  const newChannelRef = doc(channelsRef);
  const channelId = newChannelRef.id;
  const now = Date.now();

  const channelData: Channel = {
    id: channelId,
    name: name.trim(),
    description: description.trim(),
    avatar: avatarUrl || "",
    avatarUrl: avatarUrl || "",
    verified: false,
    category: "General",
    createdBy: currentUser.uid,
    createdByName: currentUser.displayName || currentUser.username || "Creator",
    createdAt: now,
    updatedAt: now,
    followers: [currentUser.uid],
    followerCount: 1,
    conversationId: channelId,
  };

  await setDoc(newChannelRef, channelData);

  // Create corresponding conversation in conversations collection
  const convRef = doc(db, "conversations", channelId);
  const convData: Conversation = {
    id: channelId,
    type: "channel",
    channelId,
    channelName: name.trim(),
    channelAvatar: avatarUrl || "",
    channelCreatedBy: currentUser.uid,
    participantIds: [currentUser.uid],
    participants: {
      [currentUser.uid]: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "Creator",
        username: currentUser.username || "creator",
        avatarUrl: currentUser.avatarUrl || avatarUrl || "",
      },
    },
    unreadCount: { [currentUser.uid]: 0 },
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(convRef, convData);

  return channelData;
}

/**
 * Follow a channel
 */
export async function followChannel(
  channelId: string,
  currentUser: UserProfile
): Promise<void> {
  const channelRef = doc(db, "channels", channelId);
  const convRef = doc(db, "conversations", channelId);

  await updateDoc(channelRef, {
    followers: arrayUnion(currentUser.uid),
    followerCount: increment(1),
    updatedAt: Date.now(),
  });

  try {
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      await updateDoc(convRef, {
        participantIds: arrayUnion(currentUser.uid),
        [`participants.${currentUser.uid}`]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "User",
          username: currentUser.username || "",
          avatarUrl: currentUser.avatarUrl || "",
        },
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn("Non-fatal: failed to update conversation participant on follow:", err);
  }
}

/**
 * Unfollow a channel
 */
export async function unfollowChannel(
  channelId: string,
  userId: string
): Promise<void> {
  const channelRef = doc(db, "channels", channelId);
  const convRef = doc(db, "conversations", channelId);

  await updateDoc(channelRef, {
    followers: arrayRemove(userId),
    followerCount: increment(-1),
    updatedAt: Date.now(),
  });

  try {
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      await updateDoc(convRef, {
        participantIds: arrayRemove(userId),
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn("Non-fatal: failed to remove conversation participant on unfollow:", err);
  }
}

/**
 * Helper to format follower counts into friendly strings (e.g. 154.2M, 1.2K, 450)
 */
export function formatFollowerCount(count?: number): string {
  if (!count || count <= 0) return "0 followers";
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M followers`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K followers`;
  }
  return `${count} follower${count === 1 ? "" : "s"}`;
}
