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

const INITIAL_CHANNELS: Array<Omit<Channel, "id" | "createdAt" | "updatedAt">> = [
  {
    name: "WhatsApp",
    avatar: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "News & Updates",
    description: "The official WhatsApp Channel. Stay up to date with new features, updates and tips.",
    createdBy: "system",
    createdByName: "WhatsApp Team",
    followers: [],
    followerCount: 154200000,
  },
  {
    name: "Real Madrid C.F.",
    avatar: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "Sports",
    description: "Welcome to the official Real Madrid Channel! Matches, highlights, press conferences and #HalaMadrid news.",
    createdBy: "system",
    createdByName: "Real Madrid",
    followers: [],
    followerCount: 56900000,
  },
  {
    name: "Tech Radar",
    avatar: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "Tech & Science",
    description: "Daily technology news, gadget reviews, phone releases, and breakthrough AI developments.",
    createdBy: "system",
    createdByName: "TechRadar Media",
    followers: [],
    followerCount: 14200000,
  },
  {
    name: "National Geographic",
    avatar: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "Nature & Wildlife",
    description: "Inspiring people to care about the planet, photography, conservation and science since 1888.",
    createdBy: "system",
    createdByName: "NatGeo Team",
    followers: [],
    followerCount: 29800000,
  },
  {
    name: "Netflix Updates",
    avatar: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "Entertainment",
    description: "New releases, trailers, behind the scenes, and watchlists for what to stream next on Netflix.",
    createdBy: "system",
    createdByName: "Netflix",
    followers: [],
    followerCount: 42100000,
  },
  {
    name: "BBC News",
    avatar: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "News",
    description: "Trusted global news, breaking alerts, documentaries and verified reporting from across the world.",
    createdBy: "system",
    createdByName: "BBC",
    followers: [],
    followerCount: 38700000,
  },
  {
    name: "Spotify Trends",
    avatar: "https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "Music",
    description: "Top charts, fresh releases, artist highlights and trending tracks worldwide.",
    createdBy: "system",
    createdByName: "Spotify",
    followers: [],
    followerCount: 21500000,
  },
  {
    name: "NASA Exploration",
    avatar: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=160&auto=format&fit=crop&q=80",
    avatarUrl: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=160&auto=format&fit=crop&q=80",
    verified: true,
    category: "Science & Space",
    description: "Discover the cosmos with Webb telescope captures, Artemis mission milestones, and Martian rover updates.",
    createdBy: "system",
    createdByName: "NASA",
    followers: [],
    followerCount: 33400000,
  },
];

/**
 * Seeds initial database channels if the channels collection has fewer than 4 items
 */
export async function seedInitialChannelsIfEmpty(): Promise<void> {
  try {
    const channelsRef = collection(db, "channels");
    const snap = await getDocs(query(channelsRef, limit(4)));
    if (snap.size >= 4) return;

    const now = Date.now();
    for (const item of INITIAL_CHANNELS) {
      const slug = item.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const channelDocRef = doc(channelsRef, slug);
      const existing = await getDoc(channelDocRef);
      if (!existing.exists()) {
        const channelData: Channel = {
          ...item,
          id: slug,
          createdAt: now,
          updatedAt: now,
          conversationId: slug,
        };
        await setDoc(channelDocRef, channelData);

        // Also ensure a corresponding conversation exists for broadcast updates
        const convRef = doc(db, "conversations", slug);
        const convSnap = await getDoc(convRef);
        if (!convSnap.exists()) {
          const convData: Conversation = {
            id: slug,
            type: "channel",
            channelId: slug,
            channelName: item.name,
            channelAvatar: item.avatarUrl || item.avatar,
            channelCreatedBy: item.createdBy,
            participantIds: [item.createdBy],
            participants: {
              [item.createdBy]: {
                uid: item.createdBy,
                displayName: item.createdByName || item.name,
                username: slug,
                avatarUrl: item.avatarUrl || "",
              },
            },
            unreadCount: {},
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(convRef, convData);
        }
      }
    }
  } catch (err) {
    console.warn("Non-fatal: seedInitialChannels error:", err);
  }
}

/**
 * Subscribes to all channels (up to limitCount) for the explore page
 */
export function subscribeToAllChannels(
  callback: (channels: Channel[]) => void,
  limitCount: number = 50
): Unsubscribe {
  const channelsRef = collection(db, "channels");
  const q = query(channelsRef, limit(limitCount));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Channel[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Channel);
      });
      // Sort by followerCount desc
      list.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
      callback(list);
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
        list.push({ id: d.id, ...d.data() } as Channel);
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
