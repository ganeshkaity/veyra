export type CallState =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "declined"
  | "missed"
  | "failed"
  | "busy";

export type CallRole = "caller" | "receiver";

export interface SdpPayload {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface CallData {
  callId: string;
  conversationId?: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  status: CallState;
  offer?: SdpPayload;
  answer?: SdpPayload;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  endReason?: string;
}

export interface IncomingCallNotification {
  callId: string;
  conversationId?: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  createdAt: number;
}

export interface CallContextType {
  callState: CallState;
  currentCall: CallData | null;
  incomingCall: IncomingCallNotification | null;
  isMuted: boolean;
  duration: number;
  formattedDuration: string;
  startCall: (targetUser: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    conversationId?: string;
  }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
}
