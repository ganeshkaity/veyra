import { ChatListItemConfig, Conversation, UserProfile } from "@/types";
import { updateUserProfile } from "./userService";

/**
 * Standard default chat lists as requested:
 * All, Unread, Favourites, Groups, Friend, Family
 */
export const DEFAULT_CHAT_LISTS: ChatListItemConfig[] = [
  { id: "all", label: "All", isDefault: true },
  { id: "unread", label: "Unread", isDefault: true },
  { id: "favourites", label: "Favourites", isDefault: true },
  { id: "groups", label: "Groups", isDefault: true },
  { id: "friend", label: "Friend", isDefault: true },
  { id: "family", label: "Family", isDefault: true },
];

/**
 * Get effective ordered chat lists for the current user.
 * Preserves default lists and user's custom lists in their configured order.
 */
export function getEffectiveChatLists(user?: UserProfile | null): ChatListItemConfig[] {
  if (!user || !user.chatLists || user.chatLists.length === 0) {
    return DEFAULT_CHAT_LISTS;
  }

  // Ensure mandatory default lists exist if user customized lists
  const configured = [...user.chatLists];
  const configuredIds = new Set(configured.map((l) => l.id));

  // If any default is missing, append it
  for (const def of DEFAULT_CHAT_LISTS) {
    if (!configuredIds.has(def.id)) {
      configured.push(def);
    }
  }

  return configured;
}

/**
 * Check if a conversation is locked by this user
 */
export function isConversationLocked(
  convId: string,
  user?: UserProfile | null
): boolean {
  if (!user || !user.lockedChatEnabled) return false;
  return Boolean(user.lockedConversationIds?.includes(convId));
}

/**
 * Verify if provided passkey matches user's chat lock passkey
 */
export function verifyPasskey(
  user: UserProfile | null | undefined,
  passkeyInput: string
): boolean {
  if (!user || !user.lockedChatPasskey) return false;
  return user.lockedChatPasskey === passkeyInput;
}

/**
 * Enable Chat Lock and set passkey
 */
export async function setChatLockPasskey(
  userId: string,
  passkey: string
): Promise<{ success: boolean; error?: string }> {
  if (!passkey || passkey.trim().length === 0) {
    return { success: false, error: "Passkey cannot be empty." };
  }
  return updateUserProfile(userId, {
    lockedChatEnabled: true,
    lockedChatPasskey: passkey,
  });
}

/**
 * Disable Chat Lock
 */
export async function disableChatLock(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  return updateUserProfile(userId, {
    lockedChatEnabled: false,
    lockedChatPasskey: "",
    lockedConversationIds: [],
  });
}

/**
 * Lock a single conversation with passkey verification
 */
export async function lockConversation(
  userId: string,
  convId: string,
  passkeyInput: string,
  user: UserProfile
): Promise<{ success: boolean; error?: string }> {
  if (!user.lockedChatEnabled || !user.lockedChatPasskey) {
    return { success: false, error: "Chat lock is not enabled in Settings." };
  }

  if (user.lockedChatPasskey !== passkeyInput) {
    return { success: false, error: "Incorrect passkey." };
  }

  const currentLocked = new Set(user.lockedConversationIds || []);
  currentLocked.add(convId);

  return updateUserProfile(userId, {
    lockedConversationIds: Array.from(currentLocked),
  });
}

/**
 * Unlock a single conversation with passkey verification
 */
export async function unlockConversation(
  userId: string,
  convId: string,
  passkeyInput: string,
  user: UserProfile
): Promise<{ success: boolean; error?: string }> {
  if (!user.lockedChatEnabled || !user.lockedChatPasskey) {
    return { success: false, error: "Chat lock is not enabled." };
  }

  if (user.lockedChatPasskey !== passkeyInput) {
    return { success: false, error: "Incorrect passkey." };
  }

  const currentLocked = (user.lockedConversationIds || []).filter(
    (id) => id !== convId
  );

  return updateUserProfile(userId, {
    lockedConversationIds: currentLocked,
  });
}

/**
 * Save customized chat lists
 */
export async function saveChatLists(
  userId: string,
  lists: ChatListItemConfig[]
): Promise<{ success: boolean; error?: string }> {
  return updateUserProfile(userId, {
    chatLists: lists,
  });
}

/**
 * Check if a conversation is in a specific list
 */
export function isConversationInList(
  convId: string,
  listId: string,
  user: UserProfile,
  conv?: Conversation
): boolean {
  if (listId === "all") return true;
  if (listId === "unread") {
    const unread = conv?.unreadCount?.[user.uid] || 0;
    return unread > 0;
  }
  if (listId === "groups") {
    return conv?.type === "group";
  }

  // Favourites list check
  if (listId === "favourites") {
    const isMarked = user.conversationListMemberships?.[convId]?.includes("favourites");
    return Boolean(isMarked);
  }

  // General or custom list memberships check
  const memberships = user.conversationListMemberships?.[convId] || [];
  return memberships.includes(listId);
}

/**
 * Toggle whether a conversation belongs to a specific list
 */
export async function toggleConversationList(
  userId: string,
  convId: string,
  listId: string,
  user: UserProfile
): Promise<{ success: boolean; isMember: boolean; error?: string }> {
  const currentMemberships = { ...(user.conversationListMemberships || {}) };
  let convLists = currentMemberships[convId] ? [...currentMemberships[convId]] : [];

  let isMember = false;
  if (convLists.includes(listId)) {
    convLists = convLists.filter((id) => id !== listId);
    isMember = false;
  } else {
    convLists.push(listId);
    isMember = true;
  }

  currentMemberships[convId] = convLists;

  const res = await updateUserProfile(userId, {
    conversationListMemberships: currentMemberships,
  });

  return { success: res.success, isMember, error: res.error };
}

/**
 * Check if a conversation is in Favourites
 */
export function isConversationFavourite(
  convId: string,
  user: UserProfile
): boolean {
  return Boolean(
    user.conversationListMemberships?.[convId]?.includes("favourites")
  );
}

/**
 * Toggle conversation favourite status
 */
export async function toggleConversationFavourite(
  userId: string,
  convId: string,
  user: UserProfile
): Promise<{ isFavourite: boolean; error?: string }> {
  const res = await toggleConversationList(userId, convId, "favourites", user);
  return { isFavourite: res.isMember, error: res.error };
}
