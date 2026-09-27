"use client";

import React from "react";
import Image from "next/image";
import { useCall } from "@/components/providers/CallProvider";
import { Icon } from "@/components/ui/Icon";

export const VoiceCallModal: React.FC = () => {
  const {
    callState,
    currentCall,
    incomingCall,
    isMuted,
    formattedDuration,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
  } = useCall();

  // If there is neither an incoming call notification nor an ongoing call state, keep hidden
  if (!incomingCall && callState === "idle") {
    return null;
  }

  // Determine display information based on whether this is an incoming prompt or ongoing session
  const isIncomingPrompt = Boolean(incomingCall && callState === "idle");

  const displayName = isIncomingPrompt
    ? incomingCall?.callerName || "Incoming Caller"
    : currentCall?.receiverName && currentCall.callerId !== currentCall.receiverId
      ? currentCall.callerName === displayNameFallback()
        ? currentCall.receiverName
        : currentCall.callerName
      : "Veyra Contact";

  function displayNameFallback(): string {
    return currentCall?.callerName || "Contact";
  }

  // Resolve target name reliably: if user is caller, target is receiver; if receiver, target is caller
  const resolvedTargetName = isIncomingPrompt
    ? incomingCall?.callerName || "Caller"
    : currentCall
      ? currentCall.callerName === displayName
        ? currentCall.callerName
        : currentCall.receiverName
      : "Contact";

  const resolvedAvatar = isIncomingPrompt
    ? incomingCall?.callerAvatar
    : currentCall?.receiverAvatar || currentCall?.callerAvatar;

  // Status subtitle and color
  let statusText = "";
  let statusColorClass = "text-slate-400";
  let showEqualizer = false;

  if (isIncomingPrompt) {
    statusText = "Incoming Voice Call...";
    statusColorClass = "text-emerald-400 font-medium animate-pulse";
  } else {
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
        statusColorClass = "text-emerald-400 font-semibold font-mono tracking-wider text-lg";
        showEqualizer = true;
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
  }

  // Get Initials for fallback avatar
  const getInitials = (n: string) => {
    if (!n) return "?";
    const parts = n.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const isTerminalState =
    callState === "ended" ||
    callState === "declined" ||
    callState === "missed" ||
    callState === "busy" ||
    callState === "failed";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-all duration-300 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-call-title"
    >
      {/* Modal Container */}
      <div className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-slate-900/95 to-slate-950/98 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center text-center overflow-hidden relative backdrop-blur-2xl">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-500/10 via-teal-500/5 to-transparent pointer-events-none" />

        {/* Center Avatar with Pulsing Rings */}
        <div className="relative my-4 flex items-center justify-center">
          {/* Animated concentric rings for ringing/incoming/connecting */}
          {(isIncomingPrompt || callState === "calling" || callState === "ringing" || callState === "connecting") && (
            <>
              <div className="absolute w-36 h-36 rounded-full border border-teal-500/40 animate-call-ring-1 pointer-events-none" />
              <div className="absolute w-48 h-48 rounded-full border border-teal-400/20 animate-call-ring-2 pointer-events-none" />
            </>
          )}

          {/* Connected subtle glow ring */}
          {callState === "connected" && (
            <div className="absolute w-32 h-32 rounded-full bg-teal-500/15 blur-xl pointer-events-none" />
          )}

          {/* Avatar Container */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white text-2xl font-bold select-none z-10">
            {resolvedAvatar ? (
              <Image
                src={resolvedAvatar}
                alt={resolvedTargetName}
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <span>{getInitials(resolvedTargetName)}</span>
            )}
          </div>
        </div>

        {/* Contact Name */}
        <h2
          id="voice-call-title"
          className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-3 mb-1 truncate max-w-[280px]"
        >
          {resolvedTargetName}
        </h2>

        {/* Status Subtitle */}
        <p className={`text-xs sm:text-sm mb-4 px-2 max-w-sm text-center leading-relaxed ${statusColorClass}`}>
          {statusText}
        </p>

        {/* Sound Wave Equalizer (Active when call is connected) */}
        {showEqualizer && (
          <div className="flex items-center justify-center gap-1.5 h-6 mb-4" aria-hidden="true">
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

        {/* Bottom Actions Controls */}
        <div className="w-full mt-4 flex items-center justify-center gap-6 z-10">
          {isIncomingPrompt ? (
            /* Incoming Call Controls: Decline and Accept */
            <>
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => declineCall()}
                  type="button"
                  title="Decline Call"
                  aria-label="Decline Call"
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all cursor-pointer"
                >
                  <Icon name="call_end" size="lg" />
                </button>
                <span className="text-xs text-slate-300 font-medium">Decline</span>
              </div>

              {/* Accept Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => acceptCall()}
                  type="button"
                  title="Accept Call"
                  aria-label="Accept Call"
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all cursor-pointer animate-bounce"
                >
                  <Icon name="call" size="lg" />
                </button>
                <span className="text-xs text-emerald-400 font-medium">Accept</span>
              </div>
            </>
          ) : isTerminalState ? (
            /* Terminal status display: End Call buttons already executed */
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={() => endCall()}
                type="button"
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-slate-300 font-medium transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          ) : (
            /* Active Call Controls */
            <>
              {/* Mute Button (available when connecting or connected) */}
              {(callState === "connected" || callState === "connecting") && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={toggleMute}
                    type="button"
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    aria-label={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                      isMuted
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/20"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/15"
                    }`}
                  >
                    <Icon name={isMuted ? "mic_off" : "mic"} size="md" />
                  </button>
                  <span className="text-xs text-slate-300 font-medium">
                    {isMuted ? "Unmute" : "Mute"}
                  </span>
                </div>
              )}

              {/* End Call Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => endCall()}
                  type="button"
                  title="End Call"
                  aria-label="End Call"
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all cursor-pointer"
                >
                  <Icon name="call_end" size="lg" />
                </button>
                <span className="text-xs text-slate-300 font-medium">End</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
