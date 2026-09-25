import {
  ref,
  set,
  onValue,
  onDisconnect,
  serverTimestamp,
  Unsubscribe,
} from "firebase/database";
import { rtdb } from "../firebase/client";
import { UserPresence, TypingIndicator } from "@/types";

/**
 * Setup Realtime Database Presence tracking for the authenticated user.
 * Automatically handles tab visibility, page close, network disconnects,
 * and reconnects via Firebase RTDB .info/connected.
 *
 * Does NOT poll Firestore.
 */
export function setupPresenceTracking(uid: string): () => void {
  if (typeof window === "undefined" || !uid) return () => {};

  const connectedRef = ref(rtdb, ".info/connected");
  const userStatusRef = ref(rtdb, `status/${uid}`);

  const setOnline = () => {
    set(userStatusRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
    }).catch((err) => console.warn("Presence setOnline error:", err));
  };

  const setOffline = () => {
    set(userStatusRef, {
      isOnline: false,
      lastSeen: serverTimestamp(),
    }).catch((err) => console.warn("Presence setOffline error:", err));
  };

  // 1. RTDB connection status monitor
  const unsubConnected = onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === false) return;

    // Register onDisconnect handler on server
    onDisconnect(userStatusRef)
      .set({
        isOnline: false,
        lastSeen: serverTimestamp(),
      })
      .then(() => {
        // Set online if page is currently visible
        if (document.visibilityState === "visible") {
          setOnline();
        }
      })
      .catch((err) => console.warn("Presence onDisconnect error:", err));
  });

  // 2. Browser tab visibility changes
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      setOffline();
    } else {
      setOnline();
    }
  };

  // 3. Page unload/hide
  const handlePageHide = () => {
    setOffline();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("beforeunload", handlePageHide);

  // Return full cleanup function
  return () => {
    unsubConnected();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("beforeunload", handlePageHide);
    setOffline();
  };
}

/**
 * Explicitly set user presence to offline (e.g. during logout)
 */
export async function setPresenceOffline(uid: string): Promise<void> {
  if (typeof window === "undefined" || !uid) return;
  try {
    const userStatusRef = ref(rtdb, `status/${uid}`);
    await set(userStatusRef, {
      isOnline: false,
      lastSeen: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Failed to set presence offline:", err);
  }
}

/**
 * Subscribe to a specific user's online presence and last seen state in Realtime Database.
 */
export function subscribeToUserPresence(
  uid: string,
  onUpdate: (presence: UserPresence | null) => void
): Unsubscribe {
  const userStatusRef = ref(rtdb, `status/${uid}`);
  return onValue(userStatusRef, (snapshot) => {
    const val = snapshot.val();
    if (val) {
      onUpdate({
        uid,
        isOnline: val.isOnline ?? false,
        lastSeen: typeof val.lastSeen === "number" ? val.lastSeen : Date.now(),
      });
    } else {
      onUpdate(null);
    }
  });
}

/**
 * Format Last Seen timestamp according to standard application messaging behavior.
 * - Online
 * - Last seen just now
 * - Last seen today at 2:45 PM
 * - Last seen yesterday at 11:20 AM
 * - Last seen on 22 Sep at 4:15 PM
 */
export function formatLastSeen(presence?: UserPresence | null): string {
  if (!presence) return "Offline";
  if (presence.isOnline) return "Online";
  if (!presence.lastSeen) return "Offline";

  const lastSeenDate = new Date(presence.lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();

  // Less than 1 minute ago
  if (diffMs < 60_000) {
    return "Last seen just now";
  }

  const timeStr = lastSeenDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const isToday =
    lastSeenDate.getDate() === now.getDate() &&
    lastSeenDate.getMonth() === now.getMonth() &&
    lastSeenDate.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Last seen today at ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    lastSeenDate.getDate() === yesterday.getDate() &&
    lastSeenDate.getMonth() === yesterday.getMonth() &&
    lastSeenDate.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Last seen yesterday at ${timeStr}`;
  }

  const dateStr = lastSeenDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: lastSeenDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });

  return `Last seen on ${dateStr} at ${timeStr}`;
}

// In-memory debounce state to prevent excessive writes to RTDB
const lastTypingWriteMap = new Map<string, number>();

/**
 * Broadcast typing state with lightweight debouncing to prevent excessive RTDB writes.
 * Inactivity is automatically handled.
 */
export async function setTypingStatus(
  conversationId: string,
  uid: string,
  username: string,
  displayName: string,
  isTyping: boolean
): Promise<void> {
  if (!conversationId || !uid) return;

  const key = `${conversationId}_${uid}`;
  const typingRef = ref(rtdb, `typing/${conversationId}/${uid}`);
  const now = Date.now();

  if (isTyping) {
    const lastWrite = lastTypingWriteMap.get(key) || 0;
    // Only write to RTDB if we haven't written in the last 2.5 seconds
    if (now - lastWrite > 2500) {
      lastTypingWriteMap.set(key, now);
      await set(typingRef, {
        uid,
        username,
        displayName,
        isTyping: true,
        timestamp: now,
      }).catch((err) => console.warn("Typing write error:", err));

      // Ensure cleanup if network disconnects while typing
      onDisconnect(typingRef).remove();
    }
  } else {
    lastTypingWriteMap.delete(key);
    await set(typingRef, null).catch((err) => console.warn("Typing clear error:", err));
  }
}

/**
 * Subscribe to typing indicators in a conversation.
 * Excludes the current user's own typing indicator.
 */
export function subscribeToTyping(
  conversationId: string,
  currentUid: string,
  onUpdate: (typists: TypingIndicator[]) => void
): Unsubscribe {
  const typingRef = ref(rtdb, `typing/${conversationId}`);
  return onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      onUpdate([]);
      return;
    }
    const typists: TypingIndicator[] = [];
    const now = Date.now();

    Object.keys(data).forEach((key) => {
      const item = data[key];
      // Only include typing if flag is true, not current user, and not stale (> 6s old)
      if (
        key !== currentUid &&
        item?.isTyping &&
        (!item.timestamp || now - item.timestamp < 6000)
      ) {
        typists.push(item);
      }
    });

    onUpdate(typists);
  });
}
