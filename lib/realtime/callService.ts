import {
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onDisconnect,
  serverTimestamp,
  Unsubscribe,
} from "firebase/database";
import { rtdb } from "../firebase/client";
import { CallData, CallState, IncomingCallNotification, SdpPayload, CallRole } from "@/types/call";

/**
 * Resolves STUN and optional TURN servers dynamically.
 * STUN provides NAT mapping; TURN fallback is used if TURN credentials
 * are configured via environment variables (e.g. NEXT_PUBLIC_TURN_URL).
 */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
    { urls: ["stun:stun.cloudflare.com:3478"] },
    { urls: ["stun:openrelay.metered.ca:80"] },
  ];

  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_TURN_URL &&
    process.env.NEXT_PUBLIC_TURN_USERNAME &&
    process.env.NEXT_PUBLIC_TURN_CREDENTIAL
  ) {
    servers.push({
      urls: process.env.NEXT_PUBLIC_TURN_URL.split(",").map((u) => u.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}

export const RTC_ICE_CONFIG: RTCConfiguration = {
  iceServers: getIceServers(),
  iceCandidatePoolSize: 2,
};


/**
 * Creates a new call record in Firebase Realtime Database
 */
export async function createCallRecord(callData: CallData): Promise<void> {
  const callRef = ref(rtdb, `calls/${callData.callId}`);
  await set(callRef, {
    ...callData,
    createdAt: serverTimestamp(),
  });
}

/**
 * Pushes incoming call notification to receiver's RTDB inbox
 */
export async function notifyReceiverIncomingCall(
  receiverId: string,
  notification: IncomingCallNotification
): Promise<void> {
  const incomingRef = ref(rtdb, `users/${receiverId}/incomingCall`);
  await set(incomingRef, {
    ...notification,
    createdAt: serverTimestamp(),
  });
}

/**
 * Listens for incoming calls to the current authenticated user
 */
export function listenForIncomingCall(
  uid: string,
  callback: (notification: IncomingCallNotification | null) => void
): Unsubscribe {
  const incomingRef = ref(rtdb, `users/${uid}/incomingCall`);
  return onValue(
    incomingRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as IncomingCallNotification);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn("Incoming call listener error:", err);
    }
  );
}

/**
 * Clears incoming call notification for a user
 */
export async function clearReceiverIncomingCall(receiverId: string): Promise<void> {
  try {
    const incomingRef = ref(rtdb, `users/${receiverId}/incomingCall`);
    await remove(incomingRef);
  } catch (err) {
    console.warn("Failed to clear incoming call:", err);
  }
}

/**
 * Subscribes to real-time changes of a specific call
 */
export function subscribeToCall(
  callId: string,
  callback: (call: CallData | null) => void
): Unsubscribe {
  const callRef = ref(rtdb, `calls/${callId}`);
  return onValue(
    callRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as CallData);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn("Call subscription error:", err);
    }
  );
}

/**
 * Updates call status (e.g. ringing, connecting, connected, ended, declined)
 */
export async function updateCallStatus(
  callId: string,
  status: CallState,
  extras?: { endReason?: string; startedAt?: number; endedAt?: number }
): Promise<void> {
  try {
    const callRef = ref(rtdb, `calls/${callId}`);
    const updates: Record<string, any> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (extras?.endReason) updates.endReason = extras.endReason;
    if (extras?.startedAt) updates.startedAt = extras.startedAt;
    if (extras?.endedAt) updates.endedAt = extras.endedAt;

    await update(callRef, updates);
  } catch (err) {
    console.warn("Failed to update call status:", err);
  }
}

/**
 * Saves WebRTC answer to the call document
 */
export async function setCallAnswer(
  callId: string,
  answer: SdpPayload
): Promise<void> {
  const answerRef = ref(rtdb, `calls/${callId}/answer`);
  await set(answerRef, answer);
}

/**
 * Adds an ICE candidate for the caller
 */
export async function addCallerIceCandidate(
  callId: string,
  candidate: RTCIceCandidate
): Promise<void> {
  const candidatesRef = ref(rtdb, `calls/${callId}/callerCandidates`);
  await push(candidatesRef, candidate.toJSON());
}

/**
 * Adds an ICE candidate for the receiver
 */
export async function addReceiverIceCandidate(
  callId: string,
  candidate: RTCIceCandidate
): Promise<void> {
  const candidatesRef = ref(rtdb, `calls/${callId}/receiverCandidates`);
  await push(candidatesRef, candidate.toJSON());
}

/**
 * Listens for caller's ICE candidates (used by receiver)
 */
export function listenForCallerCandidates(
  callId: string,
  onCandidate: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const candidatesRef = ref(rtdb, `calls/${callId}/callerCandidates`);
  return onChildAdded(candidatesRef, (snapshot) => {
    if (snapshot.exists()) {
      onCandidate(snapshot.val() as RTCIceCandidateInit);
    }
  });
}

/**
 * Listens for receiver's ICE candidates (used by caller)
 */
export function listenForReceiverCandidates(
  callId: string,
  onCandidate: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const candidatesRef = ref(rtdb, `calls/${callId}/receiverCandidates`);
  return onChildAdded(candidatesRef, (snapshot) => {
    if (snapshot.exists()) {
      onCandidate(snapshot.val() as RTCIceCandidateInit);
    }
  });
}

/**
 * Registers an onDisconnect handler on RTDB so if either party disconnects
 * abruptly (tab closed, internet dropped), the call is safely marked as ended.
 */
export function registerCallDisconnectCleanup(
  callId: string,
  receiverId: string
): () => void {
  const callStatusRef = ref(rtdb, `calls/${callId}/status`);
  const incomingRef = ref(rtdb, `users/${receiverId}/incomingCall`);

  onDisconnect(callStatusRef).set("ended").catch(() => {});
  onDisconnect(incomingRef).remove().catch(() => {});

  return () => {
    onDisconnect(callStatusRef).cancel().catch(() => {});
    onDisconnect(incomingRef).cancel().catch(() => {});
  };
}

/**
 * Cleans up temporary call data after call finishes
 */
export async function purgeCallData(callId: string, receiverId?: string): Promise<void> {
  try {
    if (receiverId) {
      await clearReceiverIncomingCall(receiverId);
    }
    // Delete signaling data after brief 5s buffer so both peers have transitioned cleanly
    setTimeout(async () => {
      try {
        const callRef = ref(rtdb, `calls/${callId}`);
        await remove(callRef);
      } catch (_) {}
    }, 5000);
  } catch (err) {
    console.warn("Failed to purge call data:", err);
  }
}

/**
 * Synchronizes camera on/off state to Firebase call record so remote peer
 * can render the avatar fallback without tearing down WebRTC
 */
export async function updateCallCameraStatus(
  callId: string,
  role: CallRole,
  isCameraOff: boolean
): Promise<void> {
  try {
    const callRef = ref(rtdb, `calls/${callId}`);
    const key = role === "caller" ? "callerCameraOff" : "receiverCameraOff";
    await update(callRef, { [key]: isCameraOff });
  } catch (err) {
    console.warn("Failed to update call camera status:", err);
  }
}

/**
 * Synchronizes mute status to Firebase call record
 */
export async function updateCallMuteStatus(
  callId: string,
  role: CallRole,
  isMuted: boolean
): Promise<void> {
  try {
    const callRef = ref(rtdb, `calls/${callId}`);
    const key = role === "caller" ? "callerMuted" : "receiverMuted";
    await update(callRef, { [key]: isMuted });
  } catch (err) {
    console.warn("Failed to update call mute status:", err);
  }
}

/**
 * Sends a request to switch an ongoing voice call to a video call
 */
export async function sendVideoCallRequest(
  callId: string,
  fromUid: string,
  fromName: string
): Promise<void> {
  try {
    const reqRef = ref(rtdb, `calls/${callId}/videoRequest`);
    await set(reqRef, {
      fromUid,
      fromName,
      status: "pending",
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn("Failed to send video call request:", err);
  }
}

/**
 * Responds to a video call switch request (accepts or rejects)
 */
export async function respondToVideoCallRequest(
  callId: string,
  accept: boolean
): Promise<void> {
  try {
    const callRef = ref(rtdb, `calls/${callId}`);
    if (accept) {
      await update(callRef, {
        callType: "video",
        "videoRequest/status": "accepted",
      });
    } else {
      await update(callRef, {
        "videoRequest/status": "rejected",
      });
    }
  } catch (err) {
    console.warn("Failed to respond to video call request:", err);
  }
}

/**
 * Clears the video call switch request from Firebase
 */
export async function clearVideoCallRequest(callId: string): Promise<void> {
  try {
    const reqRef = ref(rtdb, `calls/${callId}/videoRequest`);
    await remove(reqRef);
  } catch (err) {
    console.warn("Failed to clear video call request:", err);
  }
}


