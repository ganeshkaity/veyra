import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase/client";
import {
  StatusItem,
  UserStatusGroup,
  StatusViewerInfo,
  StatusHeartInfo,
} from "@/types";

const STATUSES_COLLECTION = "statuses";

function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result[key] = cleanFirestoreData(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          item !== null && typeof item === "object" && !Array.isArray(item)
            ? cleanFirestoreData(item)
            : item
        );
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export async function createStatus(data: {
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userAvatarUrl: string;
  type: "text" | "image" | "video";
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  mediaMetadata?: StatusItem["mediaMetadata"];
}): Promise<string> {
  const statusRef = doc(collection(db, STATUSES_COLLECTION));
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24-hour expiration window

  const statusDoc: Record<string, any> = {
    id: statusRef.id,
    userId: data.userId,
    userDisplayName: data.userDisplayName || "User",
    userUsername: data.userUsername || "",
    userAvatarUrl: data.userAvatarUrl || "",
    type: data.type,
    content: data.content || "",
    mediaUrl: data.mediaUrl || "",
    backgroundColor: data.backgroundColor || "#2563EB",
    createdAt: now,
    expiresAt,
    viewedBy: [data.userId], // Author has automatically viewed their own status
    viewers: [
      {
        userId: data.userId,
        userDisplayName: data.userDisplayName || "User",
        userUsername: data.userUsername || "",
        userAvatarUrl: data.userAvatarUrl || "",
        viewedAt: now,
        hasHearted: false,
      },
    ],
    hearts: [],
    heartBy: [],
  };

  if (data.mediaMetadata) {
    statusDoc.mediaMetadata = data.mediaMetadata;
  }

  await setDoc(statusRef, cleanFirestoreData(statusDoc));
  return statusRef.id;
}

export async function deleteStatus(statusId: string): Promise<void> {
  const statusRef = doc(db, STATUSES_COLLECTION, statusId);
  await deleteDoc(statusRef);
}

export async function recordStatusView(
  statusId: string,
  viewer: {
    uid: string;
    displayName: string;
    username?: string;
    avatarUrl?: string;
  }
): Promise<void> {
  if (!viewer?.uid) return;
  try {
    const statusRef = doc(db, STATUSES_COLLECTION, statusId);
    const snap = await getDoc(statusRef);
    if (!snap.exists()) return;
    const data = snap.data() as StatusItem;

    const viewedBy = data.viewedBy || [];
    if (!viewedBy.includes(viewer.uid)) {
      const newViewer: StatusViewerInfo = {
        userId: viewer.uid,
        userDisplayName: viewer.displayName,
        userUsername: viewer.username || "",
        userAvatarUrl: viewer.avatarUrl || "",
        viewedAt: Date.now(),
        hasHearted: (data.heartBy || []).includes(viewer.uid),
      };
      await updateDoc(statusRef, {
        viewedBy: arrayUnion(viewer.uid),
        viewers: arrayUnion(newViewer),
      });
    }
  } catch (err) {
    console.error("Failed to record status view:", err);
  }
}

export async function toggleStatusHeart(
  statusId: string,
  user: {
    uid: string;
    displayName: string;
    username?: string;
    avatarUrl?: string;
  }
): Promise<boolean> {
  if (!user?.uid) return false;
  try {
    const statusRef = doc(db, STATUSES_COLLECTION, statusId);
    const snap = await getDoc(statusRef);
    if (!snap.exists()) return false;
    const data = snap.data() as StatusItem;

    const heartBy = data.heartBy || [];
    const hearts = data.hearts || [];
    const viewers = data.viewers || [];

    const alreadyHearted = heartBy.includes(user.uid);

    if (alreadyHearted) {
      // Remove heart reaction
      const updatedHeartBy = heartBy.filter((id) => id !== user.uid);
      const updatedHearts = hearts.filter((h) => h.userId !== user.uid);
      const updatedViewers = viewers.map((v) =>
        v.userId === user.uid ? { ...v, hasHearted: false } : v
      );
      await updateDoc(statusRef, {
        heartBy: updatedHeartBy,
        hearts: updatedHearts,
        viewers: updatedViewers,
      });
      return false;
    } else {
      // Add heart reaction
      const newHeart: StatusHeartInfo = {
        userId: user.uid,
        userDisplayName: user.displayName,
        userAvatarUrl: user.avatarUrl || "",
        createdAt: Date.now(),
      };
      const updatedHeartBy = [...heartBy, user.uid];
      const updatedHearts = [...hearts.filter((h) => h.userId !== user.uid), newHeart];
      
      let updatedViewers = viewers.map((v) =>
        v.userId === user.uid ? { ...v, hasHearted: true } : v
      );
      if (!viewers.some((v) => v.userId === user.uid)) {
        updatedViewers.push({
          userId: user.uid,
          userDisplayName: user.displayName,
          userUsername: user.username || "",
          userAvatarUrl: user.avatarUrl || "",
          viewedAt: Date.now(),
          hasHearted: true,
        });
      }

      await updateDoc(statusRef, {
        heartBy: updatedHeartBy,
        hearts: updatedHearts,
        viewers: updatedViewers,
        viewedBy: arrayUnion(user.uid),
      });
      return true;
    }
  } catch (err) {
    console.error("Failed to toggle status heart:", err);
    return false;
  }
}

export function subscribeToActiveStatuses(
  currentUserId: string,
  onUpdate: (myStatuses: StatusItem[], otherGroups: UserStatusGroup[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // Query all statuses ordered by createdAt descending
  const q = query(
    collection(db, STATUSES_COLLECTION),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const allActive: StatusItem[] = [];

      snapshot.docs.forEach((docSnap) => {
        const item = docSnap.data() as StatusItem;
        // Filter out expired statuses (older than 24 hours)
        if (item.expiresAt > now) {
          allActive.push({ ...item, id: docSnap.id });
        }
      });

      // Filter own statuses (sorted oldest to newest for chronological playback)
      const myStatuses = allActive
        .filter((s) => s.userId === currentUserId)
        .sort((a, b) => a.createdAt - b.createdAt);

      // Group others' statuses by user
      const userGroupMap = new Map<string, StatusItem[]>();
      allActive
        .filter((s) => s.userId !== currentUserId)
        .forEach((s) => {
          const list = userGroupMap.get(s.userId) || [];
          list.push(s);
          userGroupMap.set(s.userId, list);
        });

      const otherGroups: UserStatusGroup[] = [];

      userGroupMap.forEach((userStatuses, uid) => {
        // Sort chronologically
        userStatuses.sort((a, b) => a.createdAt - b.createdAt);
        const latest = userStatuses[userStatuses.length - 1];
        const hasUnviewed = userStatuses.some(
          (s) => !s.viewedBy?.includes(currentUserId)
        );

        otherGroups.push({
          userId: uid,
          userDisplayName: latest.userDisplayName,
          userUsername: latest.userUsername,
          userAvatarUrl: latest.userAvatarUrl,
          statuses: userStatuses,
          latestTimestamp: latest.createdAt,
          hasUnviewed,
        });
      });

      // Sort other groups: unviewed first, then by latest timestamp descending
      otherGroups.sort((a, b) => {
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return b.latestTimestamp - a.latestTimestamp;
      });

      onUpdate(myStatuses, otherGroups);
    },
    (err) => {
      console.error("Statuses subscription error:", err);
      if (onError) onError(err);
    }
  );
}
