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
  CallType,
  IncomingCallNotification,
  VideoCallRequest,
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
  updateCallCameraStatus,
  sendVideoCallRequest,
  respondToVideoCallRequest,
  clearVideoCallRequest,
} from "@/lib/realtime/callService";

import { callSounds } from "@/lib/webrtc/audioContextHelper";
import { sendMessage } from "@/lib/firestore/conversationService";
import { webrtcLogger } from "@/lib/webrtc/webrtcLogger";
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

  const [callType, setCallType] = useState<CallType>("voice");
  const [callState, setCallState] = useState<CallState>("idle");
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallNotification | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [isRemoteCameraOff, setIsRemoteCameraOff] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(false);
  const [isSpeakerSupported, setIsSpeakerSupported] = useState<boolean>(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<"user" | "environment">("user");
  const [duration, setDuration] = useState<number>(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoRequest, setVideoRequest] = useState<VideoCallRequest | null>(null);
  const [isVideoRequestPending, setIsVideoRequestPending] = useState<boolean>(false);

  // WebRTC and Media References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // ICE Candidate Queue & State Guards for TWA/Mobile Network Reliability
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescriptionRef = useRef<boolean>(false);
  const disconnectRecoveryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  const callTypeRef = useRef<CallType>("voice");
  const incomingCallRef = useRef<IncomingCallNotification | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);


  // Sync state to refs for event handlers
  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Check hardware capabilities (multiple cameras, setSinkId speaker output)
  useEffect(() => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.enumerateDevices) return;

    // Check speaker output support
    const audioTest = document.createElement("audio");
    if (typeof (audioTest as any).setSinkId === "function") {
      setIsSpeakerSupported(true);
    }

    // Check multiple video inputs (flip camera)
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoInputs.length > 1);
      })
      .catch(() => {});
  }, []);

  // Format call duration
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
   * Safely request media stream with TWA / mobile permission fallbacks
   */
  const acquireMediaStream = async (type: CallType): Promise<MediaStream> => {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      throw new Error(
        "Media access requires a Secure Context (HTTPS or localhost). Insecure HTTP origins block microphone and camera."
      );
    }

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    webrtcLogger.log(`Requesting userMedia for ${type} call...`);

    if (type === "video") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
        webrtcLogger.log("Camera + Microphone media stream acquired successfully", {
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
        });
        return stream;
      } catch (err: any) {
        webrtcLogger.warn("Camera access denied or failed, attempting graceful fallback to audio-only:", err);
        // Fallback gracefully if camera permission was denied by user or OS
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false,
          });
          setIsCameraOff(true);
          webrtcLogger.log("Fallback audio-only stream acquired successfully");
          return audioOnlyStream;
        } catch (audioErr: any) {
          webrtcLogger.error("Microphone fallback also failed:", audioErr);
          throw audioErr;
        }
      }
    } else {
      // Voice call
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
        webrtcLogger.log("Voice audio media stream acquired successfully");
        return stream;
      } catch (err: any) {
        webrtcLogger.error("Voice microphone stream acquisition failed:", err);
        throw err;
      }
    }
  };

  /**
   * Complete internal cleanup of media tracks, peer connection, timers, and sounds
   */
  const cleanupMediaAndPeer = useCallback(() => {
    webrtcLogger.log("Cleaning up all WebRTC media, peer connections, and timers");

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    if (disconnectRecoveryTimerRef.current) {
      clearTimeout(disconnectRecoveryTimerRef.current);
      disconnectRecoveryTimerRef.current = null;
    }

    // Stop local audio and video tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close and remove peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.onsignalingstatechange = null;
        peerConnectionRef.current.close();
      } catch (_) {}
      peerConnectionRef.current = null;
    }

    // Reset candidate queues
    iceCandidateQueueRef.current = [];
    hasRemoteDescriptionRef.current = false;

    // Detach remote elements
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;
    setRemoteStream(null);

    // Cancel all Firebase listeners
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

    // Stop sound loops
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
      webrtcLogger.log(`Terminating call with state: ${terminalState}, reason: ${reason || "none"}`);
      const activeCall = currentCallRef.current;
      const finalDuration = duration;
      const formatted = formatDuration(finalDuration);
      const isVideo = activeCall?.callType === "video";

      setCallState(terminalState);
      cleanupMediaAndPeer();

      if (terminalState === "declined" || terminalState === "failed" || terminalState === "busy" || terminalState === "ended") {
        callSounds.playEndCallTone();
      }

      // Record system call message in chat history if caller
      if (activeCall?.conversationId && user) {
        try {
          let systemText = "";
          const typeLabel = isVideo ? "Video call" : "Voice call";
          if (terminalState === "ended") {
            systemText =
              finalDuration > 0
                ? ` ${typeLabel} ended • ${formatted}`
                : ` ${typeLabel} ended`;
          } else if (terminalState === "missed") {
            systemText = ` Missed ${typeLabel.toLowerCase()}`;
          } else if (terminalState === "declined") {
            systemText = ` ${typeLabel} declined`;
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

      // Return to idle after UI feedback pause
      const pauseDuration = reason === "failed" ? 3500 : 1800;
      if (resetIdleTimerRef.current) clearTimeout(resetIdleTimerRef.current);
      resetIdleTimerRef.current = setTimeout(() => {
        setCallState("idle");
        setCurrentCall(null);
        setIncomingCall(null);
        setIsMuted(false);
        setIsCameraOff(false);
        setIsRemoteCameraOff(false);
        setIsSpeakerOn(false);
        setDuration(0);
        currentRoleRef.current = null;
        activeCallIdRef.current = null;
      }, pauseDuration);
    },
    [cleanupMediaAndPeer, duration, user]
  );

  /**
   * Called when WebRTC peer connection is confirmed connected
   */
  const handleCallConnected = useCallback(() => {
    if (callStateRef.current === "connected") return;

    webrtcLogger.log("🎉 WebRTC PeerConnection successfully established (CONNECTED)");
    setCallState("connected");
    callSounds.playConnectedChime();

    // Cancel ringing timeout
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    // Cancel any disconnected recovery timer
    if (disconnectRecoveryTimerRef.current) {
      clearTimeout(disconnectRecoveryTimerRef.current);
      disconnectRecoveryTimerRef.current = null;
    }

    // Start call duration stopwatch
    setDuration(0);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Start periodic diagnostic stats inspection (every 5 seconds)
    if (peerConnectionRef.current) {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = setInterval(() => {
        if (peerConnectionRef.current) {
          webrtcLogger.inspectPeerStats(peerConnectionRef.current);
        }
      }, 5000);
    }
  }, []);

  /**
   * Helper to queue or apply incoming ICE candidates safely
   */
  const handleIncomingIceCandidate = async (candidateInit: RTCIceCandidateInit) => {
    if (!candidateInit || !candidateInit.candidate) {
      return;
    }

    const pc = peerConnectionRef.current;
    if (!pc) {
      webrtcLogger.warn("Received ICE candidate but RTCPeerConnection is null");
      return;
    }

    if (pc.remoteDescription && hasRemoteDescriptionRef.current) {
      try {
        webrtcLogger.logCandidate("Applying candidate immediately", candidateInit.candidate);
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (err) {
        webrtcLogger.warn("Failed to apply immediate ICE candidate:", err);
      }
    } else {
      webrtcLogger.logCandidate("Queuing early candidate (remoteDescription not ready yet)", candidateInit.candidate);
      iceCandidateQueueRef.current.push(candidateInit);
    }
  };

  /**
   * Flushes queued ICE candidates after remoteDescription is set
   */
  const flushQueuedIceCandidates = async (pc: RTCPeerConnection) => {
    hasRemoteDescriptionRef.current = true;
    const queuedCount = iceCandidateQueueRef.current.length;
    webrtcLogger.log(`Flushing ${queuedCount} queued ICE candidate(s)...`);

    while (iceCandidateQueueRef.current.length > 0) {
      const candidateInit = iceCandidateQueueRef.current.shift();
      if (candidateInit && candidateInit.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          webrtcLogger.logCandidate("Applied queued candidate", candidateInit.candidate);
        } catch (err) {
          webrtcLogger.warn("Failed to apply queued candidate:", err);
        }
      }
    }
  };

  /**
   * Unlock media playback on user gesture
   */
  const primeMediaPlayback = () => {
    try {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.play().catch(() => {});
      }
    } catch (_) {}
  };

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

      webrtcLogger.log("Incoming call notification received:", notification);

      const isOngoingActiveCall =
        callStateRef.current === "calling" ||
        callStateRef.current === "ringing" ||
        callStateRef.current === "connecting" ||
        callStateRef.current === "connected";

      const isSameCall =
        activeCallIdRef.current === notification.callId ||
        currentCallRef.current?.callId === notification.callId;

      if (isOngoingActiveCall && !isSameCall) {
        updateCallStatus(notification.callId, "busy", {
          endReason: "User is busy on another call",
        });
        clearReceiverIncomingCall(user.uid);
        return;
      }

      if (resetIdleTimerRef.current) {
        clearTimeout(resetIdleTimerRef.current);
        resetIdleTimerRef.current = null;
      }

      if (!isOngoingActiveCall) {
        cleanupMediaAndPeer();
        setCallState("idle");
        setCurrentCall(null);
      }

      setCallType(notification.callType || "voice");
      setIncomingCall(notification);
      callSounds.startIncomingRingtone();

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
   * Start an outgoing 1-to-1 call (Voice or Video)
   */
  const startCall = async (
    targetUser: {
      uid: string;
      displayName: string;
      avatarUrl?: string;
      conversationId?: string;
    },
    requestedType: CallType = "voice"
  ): Promise<void> => {
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

    primeMediaPlayback();

    if (resetIdleTimerRef.current) {
      clearTimeout(resetIdleTimerRef.current);
      resetIdleTimerRef.current = null;
    }
    cleanupMediaAndPeer();

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    activeCallIdRef.current = callId;
    currentRoleRef.current = "caller";
    setCallType(requestedType);

    const initialCallData: CallData = {
      callId,
      conversationId: targetUser.conversationId,
      callType: requestedType,
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
    setIsCameraOff(false);
    setIsRemoteCameraOff(false);
    setDuration(0);

    // 1. Acquire media stream safely
    let stream: MediaStream;
    try {
      stream = await acquireMediaStream(requestedType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current && stream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      webrtcLogger.error("Failed to acquire media stream for outgoing call:", err);
      await terminateCallInternal("failed", err.message || "Microphone/camera access denied.");
      return;
    }

    callSounds.startOutgoingDialTone();

    // 2. Initialize RTCPeerConnection with STUN/TURN
    webrtcLogger.log("Creating RTCPeerConnection with config:", RTC_ICE_CONFIG);
    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      webrtcLogger.log(`Adding local track: ${track.kind} (${track.label})`);
      pc.addTrack(track, stream);
    });

    // Remote track handler (Audio & Video)
    pc.ontrack = (event) => {
      webrtcLogger.log(`Received remote track: ${event.track.kind} (${event.track.id})`);
      const incomingStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      remoteStreamRef.current = incomingStream;
      setRemoteStream(incomingStream);

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = incomingStream;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current && event.track.kind === "video") {
        remoteVideoRef.current.srcObject = incomingStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        webrtcLogger.logCandidate("Generated local ICE candidate (caller)", event.candidate.candidate);
        addCallerIceCandidate(callId, event.candidate);
      } else {
        webrtcLogger.log("ICE Candidate gathering finished (null candidate received)");
      }
    };

    pc.onicegatheringstatechange = () => {
      webrtcLogger.log(`ICE Gathering State changed: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      webrtcLogger.log(`ICE Connection State changed: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        handleCallConnected();
      }
    };

    // Connection state changes with graceful temporary disconnection handling
    pc.onconnectionstatechange = () => {
      webrtcLogger.log(`PeerConnection State changed: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        handleCallConnected();
      } else if (pc.connectionState === "disconnected") {
        webrtcLogger.warn("Peer connection disconnected temporarily; starting 10s recovery timeout...");
        if (!disconnectRecoveryTimerRef.current) {
          disconnectRecoveryTimerRef.current = setTimeout(() => {
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
              terminateCallInternal("failed", "Connection lost");
            }
          }, 10000);
        }
      } else if (pc.connectionState === "failed") {
        terminateCallInternal("failed", "Connection failed");
      }
    };

    pc.onsignalingstatechange = () => {
      webrtcLogger.log(`Signaling State changed: ${pc.signalingState}`);
    };

    // 3. Create Offer and Set Local Description
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: requestedType === "video",
      });
      await pc.setLocalDescription(offer);

      webrtcLogger.log("Offer created and set as local description successfully");

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
        callType: requestedType,
        callerId: user.uid,
        callerName: profile.displayName || "Caller",
        callerAvatar: profile.avatarUrl || "",
        createdAt: Date.now(),
      });

      disconnectCleanupRef.current = registerCallDisconnectCleanup(callId, targetUser.uid);

      // 35s ringing timeout for unanswered calls
      ringingTimeoutRef.current = setTimeout(async () => {
        if (callStateRef.current === "calling" || callStateRef.current === "ringing") {
          await updateCallStatus(callId, "missed");
          await terminateCallInternal("missed", "No answer");
        }
      }, 35000);

      // 5. Listen for Receiver's Answer and Status updates
      let hasSetAnswer = false;

      callUnsubRef.current = subscribeToCall(callId, async (updatedCall) => {
        if (!updatedCall) return;

        setCurrentCall(updatedCall);

        if (updatedCall.receiverCameraOff !== undefined) {
          setIsRemoteCameraOff(updatedCall.receiverCameraOff);
        }

        // Sync Video Call Switch Request
        if (updatedCall.videoRequest) {
          setVideoRequest(updatedCall.videoRequest);
          if (
            updatedCall.videoRequest.status === "rejected" ||
            updatedCall.videoRequest.status === "accepted"
          ) {
            setIsVideoRequestPending(false);
          }
        } else {
          setVideoRequest(null);
        }

        // Check if call was upgraded to video
        if (updatedCall.callType === "video" && callTypeRef.current !== "video") {
          callTypeRef.current = "video";
          setCallType("video");
          upgradeToVideoMedia();
        }

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

        // Apply Answer once received (Synchronously guarded against duplicate invocation)
        if (
          updatedCall.answer &&
          !hasSetAnswer &&
          pc.signalingState === "have-local-offer"
        ) {
          hasSetAnswer = true;
          webrtcLogger.log("Answer received from receiver, setting remote description...");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(updatedCall.answer));
            setCallState("connecting");
            await flushQueuedIceCandidates(pc);
          } catch (err) {
            webrtcLogger.error("Failed to set remote description on answer:", err);
          }
        }
      });


      // 6. Listen for Receiver's ICE Candidates (with queueing)
      candidatesUnsubRef.current = listenForReceiverCandidates(callId, async (candidateInit) => {
        await handleIncomingIceCandidate(candidateInit);
      });
    } catch (err: any) {
      webrtcLogger.error("Failed to establish call offer:", err);
      await terminateCallInternal("failed", err.message || "Failed to initiate call");
    }
  };

  /**
   * Accept an incoming call (Voice or Video)
   */
  const acceptCall = async (): Promise<void> => {
    if (!incomingCall || !user) return;

    primeMediaPlayback();
    callSounds.stopAllSounds();

    const callId = incomingCall.callId;
    const acceptedType = incomingCall.callType || "voice";
    activeCallIdRef.current = callId;
    currentRoleRef.current = "receiver";
    setCallType(acceptedType);

    webrtcLogger.log(`Accepting ${acceptedType} call (ID: ${callId})...`);

    await clearReceiverIncomingCall(user.uid);

    setCurrentCall({
      callId,
      conversationId: incomingCall.conversationId,
      callType: acceptedType,
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
    setIsCameraOff(false);
    setIsRemoteCameraOff(false);
    setDuration(0);

    // 1. Acquire media stream safely
    let stream: MediaStream;
    try {
      stream = await acquireMediaStream(acceptedType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current && stream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      webrtcLogger.error("Microphone/camera access failed on accept:", err);
      const reasonMsg = err.message || "Microphone/camera access denied";
      await updateCallStatus(callId, "failed", { endReason: reasonMsg });
      await clearReceiverIncomingCall(user.uid);
      await terminateCallInternal("failed", reasonMsg);
      return;
    }

    // 2. Initialize RTCPeerConnection
    webrtcLogger.log("Initializing receiver RTCPeerConnection with config:", RTC_ICE_CONFIG);
    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => {
      webrtcLogger.log(`Adding local track to receiver PC: ${track.kind} (${track.label})`);
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      webrtcLogger.log(`Receiver received remote track: ${event.track.kind} (${event.track.id})`);
      const incomingStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      remoteStreamRef.current = incomingStream;
      setRemoteStream(incomingStream);

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = incomingStream;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current && event.track.kind === "video") {
        remoteVideoRef.current.srcObject = incomingStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        webrtcLogger.logCandidate("Generated local ICE candidate (receiver)", event.candidate.candidate);
        addReceiverIceCandidate(callId, event.candidate);
      } else {
        webrtcLogger.log("Receiver ICE candidate gathering completed");
      }
    };

    pc.onicegatheringstatechange = () => {
      webrtcLogger.log(`Receiver ICE Gathering State: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      webrtcLogger.log(`Receiver ICE Connection State: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        handleCallConnected();
      }
    };

    pc.onconnectionstatechange = () => {
      webrtcLogger.log(`Receiver PeerConnection State: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        handleCallConnected();
      } else if (pc.connectionState === "disconnected") {
        webrtcLogger.warn("Receiver peer connection disconnected temporarily; starting 10s recovery timeout...");
        if (!disconnectRecoveryTimerRef.current) {
          disconnectRecoveryTimerRef.current = setTimeout(() => {
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
              terminateCallInternal("failed", "Connection lost");
            }
          }, 10000);
        }
      } else if (pc.connectionState === "failed") {
        terminateCallInternal("failed", "Connection failed");
      }
    };

    pc.onsignalingstatechange = () => {
      webrtcLogger.log(`Receiver Signaling State: ${pc.signalingState}`);
    };

    try {
      let hasSetOffer = false;

      // 3. Listen for Caller's ICE Candidates IMMEDIATELY (with queueing)
      candidatesUnsubRef.current = listenForCallerCandidates(callId, async (candidateInit) => {
        await handleIncomingIceCandidate(candidateInit);
      });

      // 4. Subscribe to call data to get offer and watch status
      callUnsubRef.current = subscribeToCall(callId, async (callData) => {
        if (!callData) return;
        setCurrentCall(callData);

        if (callData.callerCameraOff !== undefined) {
          setIsRemoteCameraOff(callData.callerCameraOff);
        }

        // Sync Video Call Switch Request
        if (callData.videoRequest) {
          setVideoRequest(callData.videoRequest);
          if (
            callData.videoRequest.status === "rejected" ||
            callData.videoRequest.status === "accepted"
          ) {
            setIsVideoRequestPending(false);
          }
        } else {
          setVideoRequest(null);
        }

        // Check if call was upgraded to video
        if (callData.callType === "video" && callTypeRef.current !== "video") {
          callTypeRef.current = "video";
          setCallType("video");
          upgradeToVideoMedia();
        }

        if (callData.status === "ended") {
          await terminateCallInternal("ended", "Call ended");
          return;
        }


        // Set remote offer and create answer
        if (callData.offer && !hasSetOffer && pc.signalingState === "stable") {
          hasSetOffer = true;
          webrtcLogger.log("Setting remote description (Offer) on receiver...");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
            await flushQueuedIceCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            webrtcLogger.log("Answer created and set as local description on receiver");

            await setCallAnswer(callId, {
              type: answer.type,
              sdp: answer.sdp || "",
            });

            await clearReceiverIncomingCall(user.uid);
          } catch (err) {
            webrtcLogger.error("Failed to set remote offer or create answer on receiver:", err);
          }
        }
      });
    } catch (err: any) {
      webrtcLogger.error("Failed to accept call:", err);
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
      setIsCameraOff(false);
      setIsRemoteCameraOff(false);
      setIsSpeakerOn(false);
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
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);
        webrtcLogger.log(`Microphone ${newMuted ? "muted" : "unmuted"}`);
      }
    }
  };

  /**
   * Upgrades local media stream and peer connection to video
   */
  const upgradeToVideoMedia = async (): Promise<void> => {
    try {
      webrtcLogger.log("Upgrading ongoing audio call to video call...");
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = videoStream;
          setLocalStream(videoStream);
        }
        setIsCameraOff(false);

        const pc = peerConnectionRef.current;
        if (pc) {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, localStreamRef.current || videoStream);
          }
        }

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        webrtcLogger.log("Upgraded to video media successfully");
      }
    } catch (err) {
      webrtcLogger.warn("Camera permission denied or unavailable on video upgrade:", err);
      setIsCameraOff(true);
    }
  };

  /**
   * Request to switch an ongoing voice call to a video call
   */
  const requestVideoSwitch = async (): Promise<void> => {
    if (!currentCallRef.current?.callId || !user) return;
    webrtcLogger.log("Requesting video call switch from peer...");
    setIsVideoRequestPending(true);
    await sendVideoCallRequest(
      currentCallRef.current.callId,
      user.uid,
      profile?.displayName || "Contact"
    );
  };

  /**
   * Respond to a video call switch request (accept or decline)
   */
  const respondVideoSwitch = async (accept: boolean): Promise<void> => {
    if (!currentCallRef.current?.callId) return;
    webrtcLogger.log(`Responding to video switch request: ${accept ? "ACCEPT" : "REJECT"}`);
    await respondToVideoCallRequest(currentCallRef.current.callId, accept);
    if (accept) {
      setCallType("video");
      callTypeRef.current = "video";
      await upgradeToVideoMedia();
    }
    setVideoRequest(null);
  };

  /**
   * Toggle local camera on/off without dropping the RTCPeerConnection
   */
  const toggleCamera = async (): Promise<void> => {
    // If currently in a voice call, initiate request to switch to video
    if (callTypeRef.current === "voice") {
      await requestVideoSwitch();
      return;
    }

    const pc = peerConnectionRef.current;
    const currentStream = localStreamRef.current;

    if (!currentStream) return;

    const videoTrack = currentStream.getVideoTracks()[0];

    if (videoTrack) {
      // Toggle existing track
      videoTrack.enabled = !videoTrack.enabled;
      const cameraNowOff = !videoTrack.enabled;
      setIsCameraOff(cameraNowOff);
      webrtcLogger.log(`Local camera toggled: ${cameraNowOff ? "OFF" : "ON"}`);

      // Sync camera status to Firebase
      if (currentCallRef.current?.callId && currentRoleRef.current) {
        updateCallCameraStatus(currentCallRef.current.callId, currentRoleRef.current, cameraNowOff);
      }
    } else if (isCameraOff) {
      // Camera was disabled/never acquired, re-acquire new camera track
      try {
        webrtcLogger.log("Re-acquiring camera track...");
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacingMode },
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          currentStream.addTrack(newVideoTrack);
          setIsCameraOff(false);

          if (pc) {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              await sender.replaceTrack(newVideoTrack);
            } else {
              pc.addTrack(newVideoTrack, currentStream);
            }
          }

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = currentStream;
          }

          if (currentCallRef.current?.callId && currentRoleRef.current) {
            updateCallCameraStatus(currentCallRef.current.callId, currentRoleRef.current, false);
          }
        }
      } catch (err) {
        webrtcLogger.error("Failed to re-enable camera:", err);
      }
    }
  };


  /**
   * Flip / switch mobile camera between user and environment facing mode
   */
  const switchCamera = async (): Promise<void> => {
    const pc = peerConnectionRef.current;
    const currentStream = localStreamRef.current;
    if (!currentStream) return;

    const nextMode = currentFacingMode === "user" ? "environment" : "user";
    webrtcLogger.log(`Switching camera to: ${nextMode}`);

    try {
      const newMedia = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode },
      });
      const newTrack = newMedia.getVideoTracks()[0];

      if (newTrack) {
        const oldTrack = currentStream.getVideoTracks()[0];
        if (oldTrack) {
          currentStream.removeTrack(oldTrack);
          oldTrack.stop();
        }

        currentStream.addTrack(newTrack);
        setCurrentFacingMode(nextMode);

        if (pc) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(newTrack);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = currentStream;
        }

        webrtcLogger.log(`Camera switched to ${nextMode} successfully`);
      }
    } catch (err) {
      webrtcLogger.error("Failed to switch camera:", err);
    }
  };

  /**
   * Toggle speaker / audio output device if supported by browser/device
   */
  const toggleSpeaker = async (): Promise<void> => {
    const targetAudio = remoteAudioRef.current;
    const targetVideo = remoteVideoRef.current;

    if (!isSpeakerSupported || !targetAudio) {
      setIsSpeakerOn((prev) => !prev);
      return;
    }

    try {
      const newSpeakerState = !isSpeakerOn;
      const sinkId = newSpeakerState ? "speaker" : "default";

      if (typeof (targetAudio as any).setSinkId === "function") {
        await (targetAudio as any).setSinkId(sinkId);
      }
      if (targetVideo && typeof (targetVideo as any).setSinkId === "function") {
        await (targetVideo as any).setSinkId(sinkId);
      }

      setIsSpeakerOn(newSpeakerState);
      webrtcLogger.log(`Speaker toggled to: ${sinkId}`);
    } catch (err) {
      webrtcLogger.warn("setSinkId failed, toggled local indicator state:", err);
      setIsSpeakerOn((prev) => !prev);
    }
  };

  // Browser navigation and page unload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isCallActive =
        callStateRef.current === "calling" ||
        callStateRef.current === "ringing" ||
        callStateRef.current === "connecting" ||
        callStateRef.current === "connected";

      if (isCallActive) {
        const activeCall = currentCallRef.current;
        if (activeCall?.callId) {
          updateCallStatus(activeCall.callId, "ended");
          if (activeCall.receiverId) {
            clearReceiverIncomingCall(activeCall.receiverId);
          }
        }
        cleanupMediaAndPeer();
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
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
        callType,
        callState,
        currentCall,
        incomingCall,
        isMuted,
        isCameraOff,
        isRemoteCameraOff,
        isSpeakerOn,
        isSpeakerSupported,
        hasMultipleCameras,
        currentFacingMode,
        duration,
        formattedDuration: formatDuration(duration),
        localStream,
        remoteStream,
        videoRequest,
        isVideoRequestPending,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleCamera,
        switchCamera,
        toggleSpeaker,
        requestVideoSwitch,
        respondVideoSwitch,
      }}
    >

      {children}

      {/* Hidden audio element for WebRTC remote audio stream */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0.001,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />

      {/* Global Call UI System (Voice, Video, Incoming Banner & Fullscreen) */}
      <VoiceCallModal
        remoteVideoRef={remoteVideoRef}
        localVideoRef={localVideoRef}
      />
    </CallContext.Provider>
  );
};
