"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useCall } from "@/components/providers/CallProvider";
import { Icon } from "@/components/ui/Icon";

interface ActiveCallViewProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  remoteVideoRef,
  localVideoRef,
}) => {
  const {
    callType,
    callState,
    currentCall,
    isMuted,
    isCameraOff,
    isRemoteCameraOff,
    isSpeakerOn,
    isSpeakerSupported,
    hasMultipleCameras,
    formattedDuration,
    localStream,
    remoteStream,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleSpeaker,
  } = useCall();

  const [pipPosition, setPipPosition] = useState<"bottom-right" | "top-right" | "bottom-left">("bottom-right");

  const isVideo = callType === "video";
  const isConnected = callState === "connected";

  // Target contact info
  const targetName =
    currentCall?.callerName && currentCall.callerName !== "Caller"
      ? currentCall.callerName === currentCall.receiverName
        ? currentCall.receiverName
        : currentCall.receiverName
      : currentCall?.receiverName || "Veyra Contact";

  const resolvedAvatar = currentCall?.receiverAvatar || currentCall?.callerAvatar;

  const getInitials = (n: string) => {
    if (!n) return "?";
    const parts = n.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  // Status subtitle
  let statusText = "";
  let statusColorClass = "text-slate-300";

  switch (callState) {
    case "calling":
      statusText = "Calling...";
      statusColorClass = "text-amber-400 animate-pulse font-medium";
      break;
    case "ringing":
      statusText = "Ringing...";
      statusColorClass = "text-teal-400 animate-pulse font-medium";
      break;
    case "connecting":
      statusText = "Connecting...";
      statusColorClass = "text-blue-400 animate-pulse font-medium";
      break;
    case "connected":
      statusText = formattedDuration || "00:00";
      statusColorClass = "text-emerald-400 font-semibold font-mono tracking-wider text-base sm:text-lg";
      break;
    case "ended":
      statusText = "Call Ended";
      statusColorClass = "text-slate-400 font-medium";
      break;
    case "declined":
      statusText = "Call Declined";
      statusColorClass = "text-rose-400 font-medium";
      break;
    case "missed":
      statusText = "No Answer";
      statusColorClass = "text-amber-400 font-medium";
      break;
    case "busy":
      statusText = "Contact is on another call";
      statusColorClass = "text-amber-400 font-medium";
      break;
    case "failed":
      statusText = currentCall?.endReason || "Call Failed";
      statusColorClass = "text-rose-400 font-medium";
      break;
    default:
      statusText = "";
  }

  const isTerminalState =
    callState === "ended" ||
    callState === "declined" ||
    callState === "missed" ||
    callState === "busy" ||
    callState === "failed";

  // Cycle PiP position on click/tap
  const cyclePipPosition = () => {
    setPipPosition((prev) => {
      if (prev === "bottom-right") return "top-right";
      if (prev === "top-right") return "bottom-left";
      return "bottom-right";
    });
  };

  const pipPositionClasses = {
    "bottom-right": "bottom-24 sm:bottom-28 right-4",
    "top-right": "top-20 sm:top-24 right-4",
    "bottom-left": "bottom-24 sm:bottom-28 left-4",
  }[pipPosition];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-call-title"
      className="fixed inset-0 z-[110] flex flex-col justify-between bg-[#0e1017] text-white select-none overflow-hidden animate-in fade-in duration-300"
    >
      {/* ========================================================= */}
      {/* VIDEO STREAMS (Active when callType === "video") */}
      {/* ========================================================= */}
      {isVideo && (
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
          {/* Main View: Remote Peer's Camera Video or Avatar Placeholder */}
          {isConnected && remoteStream && !isRemoteCameraOff ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              className="w-full h-full object-cover sm:object-contain bg-black"
            />
          ) : (
            /* Camera Off / Waiting State for Remote Peer */
            <div className="flex flex-col items-center justify-center text-center p-6 z-10">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white text-3xl font-bold mb-4">
                {resolvedAvatar ? (
                  <Image
                    src={resolvedAvatar}
                    alt={targetName}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                ) : (
                  <span>{getInitials(targetName)}</span>
                )}
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-200">
                {targetName}
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <Icon name="videocam_off" size="xs" className="text-amber-400" />
                <span>
                  {isConnected
                    ? "Camera turned off"
                    : callState === "connecting"
                    ? "Connecting video..."
                    : "Calling..."}
                </span>
              </p>
            </div>
          )}

          {/* Floating Local Camera PiP Preview (Floating Window) */}
          {(callState === "connecting" || callState === "connected" || callState === "calling") && (
            <div
              onClick={cyclePipPosition}
              title="Tap to move preview"
              className={`absolute z-20 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-slate-900/90 backdrop-blur-md transition-all duration-300 cursor-pointer group ${pipPositionClasses}`}
            >
              {!isCameraOff && localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  webkit-playsinline="true"
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-slate-800">
                  <Icon name="videocam_off" size="md" className="text-slate-400 mb-1" />
                  <span className="text-[10px] text-slate-300 font-medium">Camera off</span>
                </div>
              )}

              {/* Mobile Camera Flip Button on PiP */}
              {hasMultipleCameras && !isCameraOff && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    switchCamera();
                  }}
                  type="button"
                  title="Flip camera"
                  aria-label="Flip camera"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-transform active:scale-90"
                >
                  <Icon name="flip_camera_android" size="xs" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VOICE CALL CENTER AVATAR (Active when callType === "voice") */}
      {/* ========================================================= */}
      {!isVideo && (
        <div className="relative my-auto flex flex-col items-center justify-center text-center px-4 z-10">
          <div className="relative my-6 flex items-center justify-center">
            {/* Animated Concentric Rings */}
            {(callState === "calling" || callState === "ringing" || callState === "connecting") && (
              <>
                <div className="absolute w-44 h-44 rounded-full border border-teal-500/40 animate-call-ring-1 pointer-events-none" />
                <div className="absolute w-60 h-60 rounded-full border border-teal-400/20 animate-call-ring-2 pointer-events-none" />
              </>
            )}

            {isConnected && (
              <div className="absolute w-40 h-40 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
            )}

            {/* Contact Avatar */}
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white text-3xl font-bold select-none z-10">
              {resolvedAvatar ? (
                <Image
                  src={resolvedAvatar}
                  alt={targetName}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : (
                <span>{getInitials(targetName)}</span>
              )}
            </div>
          </div>

          {/* Equalizer Wave when Connected */}
          {isConnected && (
            <div className="flex items-center justify-center gap-1.5 h-6 my-2" aria-hidden="true">
              {[14, 22, 10, 26, 18, 12, 20].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-gradient-to-t from-teal-500 to-emerald-400 rounded-full"
                  style={{
                    height: isMuted ? "4px" : `${h}px`,
                    transition: "height 0.2s ease-in-out",
                    animation: !isMuted ? `call-wave-bar 1.2s ease-in-out infinite ${i * 0.15}s` : "none",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TOP HEADER: Contact Name, Duration, Network (Matching Image 3) */}
      {/* ========================================================= */}
      <div
        className={`w-full flex flex-col items-center text-center z-20 px-6 ${
          isVideo ? "bg-gradient-to-b from-black/80 via-black/50 to-transparent pb-8" : ""
        }`}
        style={{ paddingTop: "max(24px, env(safe-area-inset-top, 24px))" }}
      >
        <h2
          id="active-call-title"
          className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate max-w-xs sm:max-w-md drop-shadow-md"
        >
          {targetName}
        </h2>

        {/* VoLTE / HD Audio Indicator + Duration (Matching Image 3) */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400/90 bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm">
            {isVideo ? "HD Video" : "VoLTE"}
          </span>
          <p className={`${statusColorClass} drop-shadow`}>
            {statusText}
          </p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM CONTROLS GRID (Matching Visual Reference Image 3) */}
      {/* ========================================================= */}
      <div
        className={`w-full flex flex-col items-center justify-center z-20 px-6 ${
          isVideo ? "bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-8" : ""
        }`}
        style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))" }}
      >
        {isTerminalState ? (
          /* Terminal State Dismissal Button */
          <div className="py-4">
            <button
              onClick={() => endCall()}
              type="button"
              className="px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-sm text-white font-semibold transition-all cursor-pointer shadow-lg backdrop-blur-md"
            >
              Dismiss
            </button>
          </div>
        ) : (
          /* Active Phone-Style Grid Controls (Matching Image 3) */
          <div className="w-full max-w-md grid grid-cols-3 gap-y-6 gap-x-4 place-items-center mb-2">
            {/* 1. Mute Microphone */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={toggleMute}
                type="button"
                title={isMuted ? "Unmute" : "Mute"}
                aria-label={isMuted ? "Unmute" : "Mute"}
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                  isMuted
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/40"
                    : "bg-white/15 hover:bg-white/25 text-white border border-white/15 backdrop-blur-md"
                }`}
              >
                <Icon name={isMuted ? "mic_off" : "mic"} size="lg" />
              </button>
              <span className="text-xs text-slate-300 font-medium">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </div>

            {/* 2. Video / Camera Control */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={toggleCamera}
                type="button"
                title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                aria-label={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                  isCameraOff
                    ? "bg-white/10 text-slate-400 border border-white/10"
                    : isVideo
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40"
                    : "bg-white/15 hover:bg-white/25 text-white border border-white/15 backdrop-blur-md"
                }`}
              >
                <Icon name={isCameraOff ? "videocam_off" : "videocam"} size="lg" />
              </button>
              <span className="text-xs text-slate-300 font-medium">
                {isCameraOff ? "Camera Off" : "Video call"}
              </span>
            </div>

            {/* 3. Speaker Output (or Flip Camera on mobile if video) */}
            {isVideo && hasMultipleCameras ? (
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={switchCamera}
                  type="button"
                  title="Switch Camera"
                  aria-label="Switch Camera"
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/15 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer active:scale-90"
                >
                  <Icon name="flip_camera_android" size="lg" />
                </button>
                <span className="text-xs text-slate-300 font-medium">Flip</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleSpeaker}
                  type="button"
                  title={isSpeakerOn ? "Turn Speaker Off" : "Turn Speaker On"}
                  aria-label={isSpeakerOn ? "Turn Speaker Off" : "Turn Speaker On"}
                  className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                    isSpeakerOn
                      ? "bg-teal-500 text-black shadow-lg shadow-teal-500/40"
                      : "bg-white/15 hover:bg-white/25 text-white border border-white/15 backdrop-blur-md"
                  }`}
                >
                  <Icon name={isSpeakerOn ? "volume_up" : "volume_down"} size="lg" />
                </button>
                <span className="text-xs text-slate-300 font-medium">Speaker</span>
              </div>
            )}

            {/* Spacer / Speaker in row 2 if video */}
            {isVideo && hasMultipleCameras ? (
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleSpeaker}
                  type="button"
                  title="Speaker"
                  className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                    isSpeakerOn
                      ? "bg-teal-500 text-black shadow-lg shadow-teal-500/40"
                      : "bg-white/15 hover:bg-white/25 text-white border border-white/15 backdrop-blur-md"
                  }`}
                >
                  <Icon name={isSpeakerOn ? "volume_up" : "volume_down"} size="lg" />
                </button>
                <span className="text-xs text-slate-300 font-medium">Speaker</span>
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-18 sm:h-18" aria-hidden="true" />
            )}

            {/* Prominent Red End Call Button (Center of Row 2) */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => endCall()}
                type="button"
                title="End Call"
                aria-label="End Call"
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-rose-600/50 transition-transform cursor-pointer"
              >
                <Icon name="call_end" size="lg" />
              </button>
              <span className="text-xs text-slate-300 font-medium">End</span>
            </div>

            {/* Empty balance spacer */}
            <div className="w-16 h-16 sm:w-18 sm:h-18" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
};
