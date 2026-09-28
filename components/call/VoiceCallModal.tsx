"use client";

import React, { useEffect, useState, useRef } from "react";
import { useCall } from "@/components/providers/CallProvider";
import { useIsInChatConversation } from "./useIsInChatConversation";
import { IncomingCallBanner } from "./IncomingCallBanner";
import { IncomingCallFullScreen } from "./IncomingCallFullScreen";
import { ActiveCallView } from "./ActiveCallView";
import { LeaveCallConfirmModal } from "./LeaveCallConfirmModal";

interface VoiceCallModalProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  remoteVideoRef,
  localVideoRef,
}) => {
  const {
    callState,
    incomingCall,
    acceptCall,
    declineCall,
    endCall,
  } = useCall();

  const isInChat = useIsInChatConversation();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const pendingBackRef = useRef(false);

  useEffect(() => {
    if (!incomingCall) {
      setIsMobileExpanded(false);
    }
  }, [incomingCall]);

  const isCallActive =
    callState === "calling" ||
    callState === "ringing" ||
    callState === "connecting" ||
    callState === "connected";

  const isHistoryPushedRef = useRef(false);

  // Android TWA / Browser back button management during an active call
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isCallActive) {
      if (!isHistoryPushedRef.current) {
        window.history.pushState({ veyraCallActive: true }, "");
        isHistoryPushedRef.current = true;
      }

      const handlePopState = () => {
        isHistoryPushedRef.current = false;
        // User pressed back button during active call: end the call
        endCall();
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    } else {
      setShowLeaveConfirm(false);
      // When call finishes, pop the pushed call history entry so browser history is clean
      if (isHistoryPushedRef.current) {
        isHistoryPushedRef.current = false;
        window.history.back();
      }
    }
  }, [isCallActive, endCall]);

  const handleConfirmLeave = async () => {
    setShowLeaveConfirm(false);
    await endCall();
  };

  const handleCancelLeave = () => {
    setShowLeaveConfirm(false);
  };

  // Determine what to display
  const hasIncomingPrompt = Boolean(
    incomingCall &&
    callState !== "connected" &&
    callState !== "connecting"
  );
  const hasActiveSession =
    callState === "connecting" ||
    callState === "connected" ||
    (callState !== "idle" && !incomingCall);

  if (!hasIncomingPrompt && !hasActiveSession) {
    return null;
  }

  return (
    <>
      {/* 1. Incoming Call Prompt: Banner when in chat (Image 2) or Fullscreen when outside chat or expanded on mobile (Image 1) */}
      {hasIncomingPrompt && incomingCall && (
        isInChat && !isMobileExpanded ? (
          <IncomingCallBanner
            notification={incomingCall}
            onAccept={acceptCall}
            onDecline={declineCall}
            onExpand={() => setIsMobileExpanded(true)}
          />
        ) : (
          <IncomingCallFullScreen
            notification={incomingCall}
            onAccept={acceptCall}
            onDecline={declineCall}
          />
        )
      )}

      {/* 2. Active Call Screen (Image 3 layout for Voice and Video) */}
      {hasActiveSession && (
        <ActiveCallView
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
        />
      )}

      {/* 3. Navigation Protection Modal */}
      <LeaveCallConfirmModal
        isOpen={showLeaveConfirm}
        onConfirmLeave={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
    </>
  );
};
