"use client";

import React from "react";
import Image from "next/image";
import { IncomingCallNotification } from "@/types/call";
import { Icon } from "@/components/ui/Icon";

interface IncomingCallFullScreenProps {
  notification: IncomingCallNotification;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallFullScreen: React.FC<IncomingCallFullScreenProps> = ({
  notification,
  onAccept,
  onDecline,
}) => {
  const isVideo = notification.callType === "video";
  const callerName = notification.callerName || "Unknown Caller";
  const avatarUrl = notification.callerAvatar;

  const getInitials = (n: string) => {
    if (!n) return "?";
    const parts = n.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Incoming Call"
      className="fixed inset-0 z-[120] flex flex-col justify-between items-center bg-gradient-to-b from-[#2a0e4a] via-[#100b21] to-[#040409] text-white select-none px-6 py-10 transition-all duration-300 animate-in fade-in"
      style={{
        paddingTop: "max(40px, env(safe-area-inset-top, 40px))",
        paddingBottom: "max(48px, env(safe-area-inset-bottom, 48px))",
      }}
    >
      {/* Top Header: Subtitle & Large Contact Name (Matching Image 1) */}
      <div className="flex flex-col items-center text-center mt-4 sm:mt-8">
        <span className="text-xs uppercase tracking-widest text-purple-200/70 font-semibold mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {isVideo ? "Incoming Video Call" : "mobile"}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight px-4 truncate max-w-sm sm:max-w-md">
          {callerName}
        </h1>
      </div>

      {/* Center: Avatar with animated pulsing rings */}
      <div className="relative my-auto flex items-center justify-center">
        {/* Animated concentric rings */}
        <div className="absolute w-44 h-44 rounded-full border border-purple-400/30 animate-call-ring-1 pointer-events-none" />
        <div className="absolute w-60 h-60 rounded-full border border-purple-300/20 animate-call-ring-2 pointer-events-none" />
        <div className="absolute w-36 h-36 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />

        {/* Center Avatar */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl shadow-purple-950/80 bg-gradient-to-tr from-slate-900 to-purple-950 flex items-center justify-center text-white text-3xl font-bold select-none z-10">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={callerName}
              fill
              sizes="144px"
              priority
              className="object-cover"
            />
          ) : (
            <span>{getInitials(callerName)}</span>
          )}
        </div>
      </div>

      {/* Bottom Controls: Decline and Accept buttons (Matching Image 1) */}
      <div className="w-full max-w-xs flex items-center justify-around z-10 mb-4">
        {/* Decline */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={onDecline}
            type="button"
            title="Decline"
            aria-label="Decline incoming call"
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-90 text-white flex items-center justify-center shadow-2xl shadow-rose-600/40 transition-transform cursor-pointer"
          >
            <Icon name="call_end" size="lg" />
          </button>
          <span className="text-xs sm:text-sm text-slate-300 font-medium">Decline</span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={onAccept}
            type="button"
            title="Accept"
            aria-label="Accept incoming call"
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 transition-transform cursor-pointer animate-bounce"
          >
            <Icon name={isVideo ? "videocam" : "call"} size="lg" />
          </button>
          <span className="text-xs sm:text-sm text-slate-300 font-medium">Accept</span>
        </div>
      </div>
    </div>
  );
};
