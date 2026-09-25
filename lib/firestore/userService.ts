import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/client";
import { UserProfile } from "@/types";
import { sanitizeUsername, validateUsername } from "../validation/username";

/**
 * Fetch a user profile by UID
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

/**
 * Check if a username is available in real time
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const sanitized = sanitizeUsername(username);
  const validation = validateUsername(sanitized);
  if (!validation.isValid) return false;

  try {
    const docRef = doc(db, "usernames", sanitized);
    const snap = await getDoc(docRef);
    return !snap.exists();
  } catch (error) {
    console.error("Error checking username availability:", error);
    return false;
  }
}

/**
 * Atomically create a user profile and claim the username in a single transaction.
 * Protected against race conditions at the database level.
 */
export async function createUserProfile(
  profile: UserProfile
): Promise<{ success: boolean; error?: string }> {
  const sanitized = sanitizeUsername(profile.username);
  const validation = validateUsername(sanitized);
  if (!validation.isValid) {
    return { success: false, error: validation.error || "Invalid username" };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, "usernames", sanitized);
      const usernameDoc = await transaction.get(usernameRef);

      if (usernameDoc.exists()) {
        const ownerUid = usernameDoc.data()?.uid;
        if (ownerUid !== profile.uid) {
          throw new Error("This username is already taken. Please choose another.");
        }
      }

      const userRef = doc(db, "users", profile.uid);

      // Reserve username lookup document
      transaction.set(usernameRef, {
        uid: profile.uid,
        reservedAt: Date.now(),
      });

      // Write user profile document
      transaction.set(userRef, {
        ...profile,
        username: sanitized,
        mobileNumber: profile.mobileNumber || profile.phoneNumber || "",
        phoneNumber: profile.mobileNumber || profile.phoneNumber || "",
        createdAt: profile.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    });

    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create user profile.";
    console.error("Error creating user profile:", error);
    return { success: false, error: message };
  }
}

/**
 * Atomically change a user's username.
 * Releases the old username record, reserves the new one, updates the user's profile,
 * and updates participant metadata in existing conversations so nothing breaks.
 */
export async function changeUsername(
  uid: string,
  oldUsername: string,
  newUsername: string
): Promise<{ success: boolean; error?: string }> {
  const sanitizedNew = sanitizeUsername(newUsername);
  const sanitizedOld = sanitizeUsername(oldUsername);

  if (sanitizedNew === sanitizedOld) {
    return { success: true };
  }

  const validation = validateUsername(sanitizedNew);
  if (!validation.isValid) {
    return { success: false, error: validation.error || "Invalid username" };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const newUsernameRef = doc(db, "usernames", sanitizedNew);
      const newUsernameDoc = await transaction.get(newUsernameRef);

      if (newUsernameDoc.exists()) {
        const ownerUid = newUsernameDoc.data()?.uid;
        if (ownerUid !== uid) {
          throw new Error("This username is already taken by another user.");
        }
      }

      // Check current user document
      const userRef = doc(db, "users", uid);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User record not found.");
      }

      // 1. Release old username document if exists
      if (sanitizedOld) {
        const oldUsernameRef = doc(db, "usernames", sanitizedOld);
        transaction.delete(oldUsernameRef);
      }

      // 2. Claim new username
      transaction.set(newUsernameRef, {
        uid,
        updatedAt: Date.now(),
      });

      // 3. Update user profile document
      transaction.update(userRef, {
        username: sanitizedNew,
        updatedAt: Date.now(),
      });
    });

    // 4. Update existing conversations to preserve conversation consistency
    try {
      const convsRef = collection(db, "conversations");
      const q = query(convsRef, where("participantIds", "array-contains", uid), limit(30));
      const snaps = await getDocs(q);

      if (!snaps.empty) {
        const batch = writeBatch(db);
        snaps.forEach((convDoc) => {
          batch.update(convDoc.ref, {
            [`participants.${uid}.username`]: sanitizedNew,
          });
        });
        await batch.commit();
      }
    } catch (syncErr) {
      console.warn("Non-fatal: Error updating username in existing conversations:", syncErr);
    }

    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to change username.";
    console.error("Error changing username:", error);
    return { success: false, error: message };
  }
}

/**
 * Update general user profile fields (displayName, bio, avatarUrl, mobileNumber).
 * Also synchronizes displayName/avatar in active conversations.
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, "users", uid);
    const cleanUpdates = {
      ...updates,
      mobileNumber: updates.mobileNumber || updates.phoneNumber || "",
      phoneNumber: updates.mobileNumber || updates.phoneNumber || "",
      updatedAt: Date.now(),
    };

    await updateDoc(docRef, cleanUpdates);

    // Sync displayName / avatarUrl in conversations if changed
    if (updates.displayName || updates.avatarUrl) {
      try {
        const convsRef = collection(db, "conversations");
        const q = query(convsRef, where("participantIds", "array-contains", uid), limit(30));
        const snaps = await getDocs(q);

        if (!snaps.empty) {
          const batch = writeBatch(db);
          snaps.forEach((convDoc) => {
            const patch: Record<string, any> = {};
            if (updates.displayName) {
              patch[`participants.${uid}.displayName`] = updates.displayName;
            }
            if (updates.avatarUrl) {
              patch[`participants.${uid}.avatarUrl`] = updates.avatarUrl;
            }
            batch.update(convDoc.ref, patch);
          });
          await batch.commit();
        }
      } catch (syncErr) {
        console.warn("Non-fatal: Error syncing profile in conversations:", syncErr);
      }
    }

    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile.";
    console.error("Error updating user profile:", error);
    return { success: false, error: message };
  }
}

/**
 * Search users by username prefix (@username)
 */
export async function searchUsersByUsername(
  searchQuery: string
): Promise<UserProfile[]> {
  const sanitized = sanitizeUsername(searchQuery);
  if (!sanitized) return [];

  try {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("username", ">=", sanitized),
      where("username", "<=", sanitized + "\uf8ff"),
      limit(10)
    );

    const snapshot = await getDocs(q);
    const results: UserProfile[] = [];
    snapshot.forEach((d) => {
      results.push(d.data() as UserProfile);
    });
    return results;
  } catch (error) {
    console.error("Error searching users by username:", error);
    return [];
  }
}
