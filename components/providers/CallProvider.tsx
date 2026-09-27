"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useAuth } from "./AuthProvider";
import {
  CallContextType,
  CallData,
  CallRole,
  CallState,
  IncomingCallNotification,
} from "@/types/call";
import {
  RTC_ICE_CONFIG,
  createCallRecord,
  notifyReceiverIncomingCall,
  listenForIncomingCall,
  clearReceiverIncomingCall,
  subscribeToCall,
  updateCallStatus,
  setCallAnswer,
  addCallerIceCandidate,
  addReceiverIceCandidate,
  listenForCallerCandidates,
  listenForReceiverCandidates,
  registerCallDisconnectCleanup,
  purgeCallData,
} from "@/lib/realtime/callService";
import { callSounds } from "@/lib/webrtc/audioContextHelper";
import { sendMessage } from "@/lib/firestore/conversationService";
import { VoiceCallModal } from "@/components/call/VoiceCallModal";

const CallContext = createContext<CallContextType | null>(null);

export const useCall = (): CallContextType => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();

  const [callState, setCallState] = useState<CallState>("idle");
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallNotification | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);

  // WebRTC and Media References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Subscriptions & Timers
  const callUnsubRef = useRef<(() => void) | null>(null);
  const candidatesUnsubRef = useRef<(() => void) | null>(null);
  const disconnectCleanupRef = useRef<(() => void) | null>(null);
  const ringingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetIdleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentRoleRef = useRef<CallRole | null>(null);
  const currentCallRef = useRef<CallData | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const incomingCallRef = useRef<IncomingCallNotification | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  // Keep refs in sync with state for callbacks
  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Format call duration as mm:ss (or hh:mm:ss if > 1 hour)
  const formatDuration = (secs: number): string => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  /**
   * Safely request microphone media stream with Secure Context and vendor fallback validation
   */
  const acquireMicrophoneStream = async (): Promise<MediaStream> => {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      throw new Error(
        "Microphone access requires a Secure Context (HTTPS or localhost). Insecure HTTP origins block audio capture."
      );
    }

    if (navigator?.mediaDevices?.getUserMedia) {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    }

    const legacyNav = typeof navigator !== "undefined" ? (navigator as any) : null;
    const legacyGetUserMedia =
      legacyNav?.getUserMedia ||
      legacyNav?.webkitGetUserMedia ||
      legacyNav?.mozGetUserMedia ||
      legacyNav?.msGetUserMedia;

    if (legacyGetUserMedia) {
      return new Promise<MediaStream>((resolve, reject) => {
        legacyGetUserMedia.call(
          navigator,
          {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          },
          resolve,
          reject
        );
      });
    }

    throw new Error(
      "Microphone access is not supported or blocked in this browser context (HTTPS required)."
    );
  };

  /**
   * Complete internal cleanup of media tracks, peer connection, and sound effects
   */
  const cleanupMediaAndPeer = useCallback(() => {
    // Stop local audio tracks so browser microphone recording turns off
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Close and remove peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.close();
      } catch (_) {}
      peerConnectionRef.current = null;
    }

    // Detach remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    // Cancel all listeners
    if (callUnsubRef.current) {
      callUnsubRef.current();
      callUnsubRef.current = null;
    }
    if (candidatesUnsubRef.current) {
      candidatesUnsubRef.current();
      candidatesUnsubRef.current = null;
    }
    if (disconnectCleanupRef.current) {
      disconnectCleanupRef.current();
      disconnectCleanupRef.current = null;
    }

    // Clear timers
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // Stop all audio playback
    callSounds.stopAllSounds();
  }, []);

  /**
   * Finalizes call termination and transitions back to idle
   */
  const terminateCallInternal = useCallback(
    async (
      terminalState: "ended" | "declined" | "missed" | "failed" | "busy",
      reason?: string
    ) => {
      const activeCall = currentCallRef.current;
      const finalDuration = duration;
      const formatted = formatDuration(finalDuration);

      setCallState(terminalState);
      cleanupMediaAndPeer();

      if (terminalState === "declined" || terminalState === "failed" || terminalState === "busy") {
        callSounds.playEndCallTone();
      } else if (terminalState === "ended") {
        callSounds.playEndCallTone();
      }

      // Record system call message in chat history if connected or missed
      if (activeCall?.conversationId && user) {
        try {
          let systemText = "";
          if (terminalState === "ended") {
            systemText =
              finalDuration > 0
                ? `📞 Voice call ended • ${formatted}`
                : "📞 Voice call ended";
          } else if (terminalState === "missed") {
            systemText = "📞 Missed voice call";
          } else if (terminalState === "declined") {
            systemText = "📞 Voice call declined";
          }

          if (systemText && currentRoleRef.current === "caller") {
            await sendMessage(activeCall.conversationId, {
              conversationId: activeCall.conversationId,
              senderId: "system",
              senderName: "Veyra System",
              text: systemText,
              type: "system",
            });
          }
        } catch (_) {}
      }

      // Clear RTDB data
      activeCallIdRef.current = null;
      if (activeCall?.callId) {
        purgeCallData(activeCall.callId, activeCall.receiverId);
      }

      // Return to idle after a brief UI feedback pause (3.5s for failures/errors, 1.8s for normal completion)
      const pauseDuration = reason === "failed" ? 3500 : 1800;
      if (resetIdleTimerRef.current) clearTimeout(resetIdleTimerRef.current);
      resetIdleTimerRef.current = setTimeout(() => {
        setCallState("idle");
        setCurrentCall(null);
        setIncomingCall(null);
        setIsMuted(false);
        setDuration(0);
        currentRoleRef.current = null;
        activeCallIdRef.current = null;
      }, pauseDuration);
    },
    [cleanupMediaAndPeer, duration, user]
  );

  /**
   * Called when WebRTC peer connection is successfully established
   */
  const handleCallConnected = useCallback(() => {
    if (callStateRef.current === "connected") return;

    setCallState("connected");
    callSounds.playConnectedChime();

    // Cancel ringing timeout
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    // Start call duration stopwatch
    setDuration(0);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  /**
   * Listen for incoming calls whenever the user is authenticated
   */
  useEffect(() => {
    if (!user) return;

    const unsub = listenForIncomingCall(user.uid, (notification) => {
      if (!notification) {
        if (incomingCallRef.current && callStateRef.current === "idle") {
          callSounds.stopAllSounds();
          setIncomingCall(null);
        }
        return;
      }

      // Check if user is currently engaged in an active ongoing call
      const isOngoingActiveCall =
        callStateRef.current === "calling" ||
        callStateRef.current === "ringing" ||
        callStateRef.current === "connecting" ||
        callStateRef.current === "connected";

      const isSameCall =
        activeCallIdRef.current === notification.callId ||
        currentCallRef.current?.callId === notification.callId;

      // Only reject if user is actually on a call with a different peer
      if (isOngoingActiveCall && !isSameCall) {
        updateCallStatus(notification.callId, "busy", {
          endReason: "User is busy on another call",
        });
        clearReceiverIncomingCall(user.uid);
        return;
      }

      // If user was previously in a terminal post-call state (ended/declined/failed/missed/busy),
      // cancel the dismissal timeout and reset media so the incoming call can be received
      if (resetIdleTimerRef.current) {
        clearTimeout(resetIdleTimerRef.current);
        resetIdleTimerRef.current = null;
      }

      if (!isOngoingActiveCall) {
        cleanupMediaAndPeer();
        setCallState("idle");
        setCurrentCall(null);
      }

      // Start ringing for incoming call
      setIncomingCall(notification);
      callSounds.startIncomingRingtone();

      // Listen to the call document in case the caller cancels or disconnects
      const unsubCall = subscribeToCall(notification.callId, (callData) => {
        if (!callData) {
          callSounds.stopAllSounds();
          setIncomingCall(null);
          return;
        }

        if (
          callData.status === "ended" ||
          callData.status === "declined" ||
          callData.status === "missed"
        ) {
          callSounds.stopAllSounds();
          setIncomingCall(null);
          unsubCall();
        }
      });

      return () => {
        unsubCall();
      };
    });

    return () => {
      unsub();
      callSounds.stopAllSounds();
    };
  }, [user?.uid, cleanupMediaAndPeer]);

  /**
   * Start an outgoing 1-to-1 voice call
   */
  const startCall = async (targetUser: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    conversationId?: string;
  }): Promise<void> => {
    if (!user || !profile) {
      throw new Error("You must be logged in to make a call.");
    }

    if (targetUser.uid === user.uid) {
      throw new Error("You cannot call yourself.");
    }

    const isOngoingCall =
      callStateRef.current === "calling" ||
      callStateRef.current === "ringing" ||
      callStateRef.current === "connecting" ||
      callStateRef.current === "connected";

    if (isOngoingCall) {
      throw new Error("You are already on an active call.");
    }

    if (resetIdleTimerRef.current) {
      clearTimeout(resetIdleTimerRef.current);
      resetIdleTimerRef.current = null;
    }
    cleanupMediaAndPeer();

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    activeCallIdRef.current = callId;
    currentRoleRef.current = "caller";

    const initialCallData: CallData = {
      callId,
      conversationId: targetUser.conversationId,
      callerId: user.uid,
      callerName: profile.displayName || "Caller",
      callerAvatar: profile.avatarUrl || "",
      receiverId: targetUser.uid,
      receiverName: targetUser.displayName,
      receiverAvatar: targetUser.avatarUrl || "",
      status: "calling",
      createdAt: Date.now(),
    };

    setCurrentCall(initialCallData);
    setCallState("calling");
    setIsMuted(false);
    setDuration(0);

    // 1. Request microphone permission safely
    let localStream: MediaStream;
    try {
      localStream = await acquireMicrophoneStream();
      localStreamRef.current = localStream;
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      await terminateCallInternal("failed", err.message || "Microphone access denied. Please grant permission.");
      return;
    }

    // Play outgoing dial tone
    callSounds.startOutgoingDialTone();

    // 2. Initialize RTCPeerConnection
    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    localStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Remote audio stream handler
    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addCallerIceCandidate(callId, event.candidate);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        handleCallConnected();
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        terminateCallInternal("failed", "Connection lost");
      }
    };

    // 3. Create Offer and Set Local Description
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);

      const offerPayload = {
        type: offer.type,
        sdp: offer.sdp || "",
      };

      initialCallData.offer = offerPayload;

      // 4. Write call record and notify receiver via RTDB
      await createCallRecord(initialCallData);
      await notifyReceiverIncomingCall(targetUser.uid, {
        callId,
        conversationId: targetUser.conversationId,
        callerId: user.uid,
        callerName: profile.displayName || "Caller",
        callerAvatar: profile.avatarUrl || "",
        createdAt: Date.now(),
      });

      // Register disconnect handler
      disconnectCleanupRef.current = registerCallDisconnectCleanup(callId, targetUser.uid);

      // 35s ringing timeout for unanswered calls
      ringingTimeoutRef.current = setTimeout(async () => {
        if (callStateRef.current === "calling" || callStateRef.current === "ringing") {
          await updateCallStatus(callId, "missed");
          await terminateCallInternal("missed", "No answer");
        }
      }, 35000);

      // 5. Listen for Receiver's Answer and Status updates
      callUnsubRef.current = subscribeToCall(callId, async (updatedCall) => {
        if (!updatedCall) return;

        setCurrentCall(updatedCall);

        // Status update handling
        if (updatedCall.status === "ringing" && callStateRef.current === "calling") {
          setCallState("ringing");
        } else if (updatedCall.status === "declined") {
          await terminateCallInternal("declined", "Call declined");
        } else if (updatedCall.status === "busy") {
          await terminateCallInternal("busy", "User is busy on another call");
        } else if (updatedCall.status === "ended") {
          await terminateCallInternal("ended", "Call ended");
        } else if (updatedCall.status === "failed") {
          await terminateCallInternal("failed", updatedCall.endReason || "Call failed");
        }

        // Apply Answer once received
        if (
          updatedCall.answer &&
          pc.signalingState === "have-local-offer"
        ) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(updatedCall.answer));
            setCallState("connecting");
          } catch (err) {
            console.error("Failed to set remote description on answer:", err);
          }
        }
      });

      // 6. Listen for Receiver's ICE Candidates
      candidatesUnsubRef.current = listenForReceiverCandidates(callId, async (candidateInit) => {
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          }
        } catch (err) {
          console.warn("Failed to add receiver ICE candidate:", err);
        }
      });
    } catch (err: any) {
      console.error("Failed to establish call offer:", err);
      await terminateCallInternal("failed", err.message || "Failed to initiate call");
    }
  };

  /**
   * Accept an incoming call
   */
  const acceptCall = async (): Promise<void> => {
    if (!incomingCall || !user) return;

    callSounds.stopAllSounds();
    const callId = incomingCall.callId;
    activeCallIdRef.current = callId;
    currentRoleRef.current = "receiver";

    // Clear incoming call from RTDB immediately so no duplicate listener triggers
    await clearReceiverIncomingCall(user.uid);

    setCurrentCall({
      callId,
      conversationId: incomingCall.conversationId,
      callerId: incomingCall.callerId,
      callerName: incomingCall.callerName,
      callerAvatar: incomingCall.callerAvatar,
      receiverId: user.uid,
      receiverName: profile?.displayName || "Receiver",
      receiverAvatar: profile?.avatarUrl || "",
      status: "connecting",
      createdAt: incomingCall.createdAt,
    });

    setCallState("connecting");
    setIncomingCall(null);
    setIsMuted(false);
    setDuration(0);

    // 1. Request microphone permission safely
    let localStream: MediaStream;
    try {
      localStream = await acquireMicrophoneStream();
      localStreamRef.current = localStream;
    } catch (err: any) {
      console.error("Microphone access failed on accept:", err);
      const reasonMsg = err.message || "Receiver microphone access denied";
      await updateCallStatus(callId, "failed", {
        endReason: reasonMsg,
      });
      await clearReceiverIncomingCall(user.uid);
      await terminateCallInternal("failed", reasonMsg);
      return;
    }

    // 2. Initialize RTCPeerConnection
    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    peerConnectionRef.current = pc;

    localStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addReceiverIceCandidate(callId, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        handleCallConnected();
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        terminateCallInternal("failed", "Connection lost");
      }
    };

    try {
      // 3. Subscribe to call data to get offer and watch status
      let hasSetOffer = false;

      callUnsubRef.current = subscribeToCall(callId, async (callData) => {
        if (!callData) return;
        setCurrentCall(callData);

        if (callData.status === "ended") {
          await terminateCallInternal("ended", "Call ended");
          return;
        }

        // Set remote offer and create answer
        if (callData.offer && !hasSetOffer && pc.signalingState === "stable") {
          hasSetOffer = true;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await setCallAnswer(callId, {
              type: answer.type,
              sdp: answer.sdp || "",
            });

            await updateCallStatus(callId, "connected", { startedAt: Date.now() });
            await clearReceiverIncomingCall(user.uid);
          } catch (err) {
            console.error("Failed to set remote offer or create answer:", err);
          }
        }
      });

      // 4. Listen for Caller's ICE Candidates
      candidatesUnsubRef.current = listenForCallerCandidates(callId, async (candidateInit) => {
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          }
        } catch (err) {
          console.warn("Failed to add caller ICE candidate:", err);
        }
      });
    } catch (err: any) {
      console.error("Failed to accept call:", err);
      await terminateCallInternal("failed", "Failed to connect call");
    }
  };

  /**
   * Decline an incoming call
   */
  const declineCall = async (): Promise<void> => {
    callSounds.stopAllSounds();
    callSounds.playEndCallTone();

    if (incomingCall && user) {
      const callId = incomingCall.callId;
      await updateCallStatus(callId, "declined");
      await clearReceiverIncomingCall(user.uid);
      setIncomingCall(null);
    }
    setCallState("idle");
  };

  /**
   * End an ongoing call or cancel outgoing calling
   */
  const endCall = async (): Promise<void> => {
    // If in a terminal post-call state (failed, ended, declined, missed, busy), immediately reset to idle
    if (
      callStateRef.current === "ended" ||
      callStateRef.current === "declined" ||
      callStateRef.current === "missed" ||
      callStateRef.current === "failed" ||
      callStateRef.current === "busy"
    ) {
      if (resetIdleTimerRef.current) {
        clearTimeout(resetIdleTimerRef.current);
        resetIdleTimerRef.current = null;
      }
      cleanupMediaAndPeer();
      setCallState("idle");
      setCurrentCall(null);
      setIncomingCall(null);
      setIsMuted(false);
      setDuration(0);
      currentRoleRef.current = null;
      activeCallIdRef.current = null;
      return;
    }

    const activeCall = currentCallRef.current;
    if (activeCall?.callId) {
      await updateCallStatus(activeCall.callId, "ended", { endedAt: Date.now() });
    }
    await terminateCallInternal("ended", "Call ended");
  };

  /**
   * Toggle mute status of local microphone
   */
  const toggleMute = (): void => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Browser page unload / hide cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeCall = currentCallRef.current;
      if (activeCall?.callId && callStateRef.current !== "idle") {
        updateCallStatus(activeCall.callId, "ended");
        if (activeCall.receiverId) {
          clearReceiverIncomingCall(activeCall.receiverId);
        }
      }
      cleanupMediaAndPeer();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      cleanupMediaAndPeer();
    };
  }, [cleanupMediaAndPeer]);

  return (
    <CallContext.Provider
      value={{
        callState,
        currentCall,
        incomingCall,
        isMuted,
        duration,
        formattedDuration: formatDuration(duration),
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
      }}
    >
      {children}

      {/* Hidden audio element for WebRTC remote stream playback */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="hidden pointer-events-none"
        aria-hidden="true"
      />

      {/* Global Voice Calling Modal / Overlay */}
      <VoiceCallModal />
    </CallContext.Provider>
  );
};
