export type CallType = "voice" | "video";

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
  callType: CallType;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  status: CallState;
  offer?: SdpPayload;
  answer?: SdpPayload;
  callerCameraOff?: boolean;
  receiverCameraOff?: boolean;
  callerMuted?: boolean;
  receiverMuted?: boolean;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  endReason?: string;
}

export interface IncomingCallNotification {
  callId: string;
  conversationId?: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  createdAt: number;
}

export interface CallContextType {
  callType: CallType;
  callState: CallState;
  currentCall: CallData | null;
  incomingCall: IncomingCallNotification | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isRemoteCameraOff: boolean;
  isSpeakerOn: boolean;
  isSpeakerSupported: boolean;
  hasMultipleCameras: boolean;
  currentFacingMode: "user" | "environment";
  duration: number;
  formattedDuration: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (
    targetUser: {
      uid: string;
      displayName: string;
      avatarUrl?: string;
      conversationId?: string;
    },
    callType?: CallType
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
}

