export interface ChatListItemConfig {
  id: string;
  label: string;
  isDefault?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string; // stored without '@'
  avatarUrl: string;
  bio: string;
  mobileNumber?: string;
  phoneNumber?: string;
  createdAt: number;
  updatedAt: number;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  authProviders: ('google' | 'password')[];
  readReceiptsEnabled?: boolean;
  enterIsSend?: boolean;
  chatWallpaper?: string;
  mediaAutoDownload?: boolean;

  // Lock Chat feature
  lockedChatEnabled?: boolean;
  lockedChatPasskey?: string;
  lockedConversationIds?: string[];

  // Chat Lists feature
  chatLists?: ChatListItemConfig[];
  conversationListMemberships?: Record<string, string[]>;
}

export type MessageType = 'text' | 'image' | 'gif' | 'sticker' | 'system' | 'call';
export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export interface CallMessageInfo {
  callType: 'voice' | 'video';
  status: 'ended' | 'missed' | 'declined';
  duration?: number;
  formattedDuration?: string;
  subtitle?: string;
  callerId?: string;
  receiverId?: string;
}

export interface MessageReplyInfo {
  messageId: string;
  text: string;
  senderName: string;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  size?: number;
  sizeBytes?: number;
  mimeType?: string;
  duration?: number;
  fileName?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaQuality?: 'sd' | 'hd';
  mediaMetadata?: MediaMetadata;
  callInfo?: CallMessageInfo;
  replyTo?: MessageReplyInfo;
  status: MessageDeliveryStatus;
  isEdited?: boolean;
  edited?: boolean;
  editedAt?: number;
  isDeletedForEveryone?: boolean;
  deletedForEveryone?: boolean;
  deletedForUsers?: string[];
  starredBy?: string[];
  forwarded?: boolean;
  reactions?: Record<string, { emoji: string; userId: string; userName: string; userAvatar?: string; timestamp: number }>;
  createdAt: number;
  updatedAt?: number;
}

export interface ConversationParticipant {
  uid: string;
  displayName: string;
  username: string;
  avatarUrl: string;
}

export interface Channel {
  id: string;
  name: string;
  avatar?: string;
  avatarUrl?: string;
  description?: string;
  category?: string;
  verified?: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
  followers?: string[];
  followerCount?: number;
  conversationId?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'ai' | 'channel';
  participantIds: string[];
  participants: Record<string, ConversationParticipant>;
  groupId?: string;
  groupName?: string;
  groupAvatar?: string;
  channelId?: string;
  channelName?: string;
  channelAvatar?: string;
  channelCreatedBy?: string;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: number;
    type: MessageType;
    status?: MessageDeliveryStatus;
  };
  unreadCount?: Record<string, number>;
  archivedBy?: string[];
  pinnedBy?: string[];
  deletedBy?: string[];
  leftParticipantIds?: string[];
  clearedAt?: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface GroupSettings {
  whoCanAddMembers: 'admins' | 'all';
  whoCanSendMessages?: 'admins' | 'all';
  whoCanEditGroupInfo?: 'admins' | 'all';
}

export interface GroupDetails {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  createdById?: string;
  admins: string[];
  adminIds?: string[];
  members: string[];
  memberIds?: string[];
  leftMemberIds?: string[];
  settings: GroupSettings;
  inviteCode?: string;
  permissions?: {
    onlyAdminsCanAddMembers: boolean;
    onlyAdminsCanEditInfo: boolean;
  };
}

export interface UserPresence {
  uid: string;
  isOnline: boolean;
  lastSeen: number;
}

export interface TypingIndicator {
  uid: string;
  username: string;
  displayName: string;
  isTyping: boolean;
}

export interface UserSettings {
  uid: string;
  theme: 'light' | 'dark';
  wallpaperType: 'default' | 'custom';
  customWallpaperUrl?: string;
  readReceipts: boolean;
}

export interface StatusViewerInfo {
  userId: string;
  userDisplayName: string;
  userUsername?: string;
  userAvatarUrl?: string;
  viewedAt: number;
  hasHearted?: boolean;
}

export interface StatusHeartInfo {
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;
  createdAt: number;
}

export interface StatusItem {
  id: string;
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userAvatarUrl: string;
  type: 'text' | 'image' | 'video';
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  fontFamily?: string;
  createdAt: number;
  expiresAt: number;
  viewedBy?: string[];
  viewers?: StatusViewerInfo[];
  hearts?: StatusHeartInfo[];
  heartBy?: string[];
  mediaMetadata?: MediaMetadata;
}

export interface UserStatusGroup {
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userAvatarUrl: string;
  statuses: StatusItem[];
  latestTimestamp: number;
  hasUnviewed: boolean;
}

