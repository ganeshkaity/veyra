"use client";

import React from "react";
import Image from "next/image";
import { IncomingCallNotification } from "@/types/call";
import { Icon } from "@/components/ui/Icon";

interface IncomingCallBannerProps {
  notification: IncomingCallNotification;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallBanner: React.FC<IncomingCallBannerProps> = ({
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
      role="alert"
      aria-label="Incoming Call"
      className="fixed inset-x-3 sm:inset-x-auto sm:right-6 sm:w-[410px] z-[120] animate-in slide-in-from-top-4 duration-300 ease-out select-none"
      style={{ top: "max(12px, env(safe-area-inset-top, 12px))" }}
    >
      <div className="w-full bg-[#181C24]/95 border border-white/15 rounded-3xl p-3.5 shadow-2xl shadow-black/80 backdrop-blur-2xl flex items-center justify-between gap-3">
        {/* Left: Avatar with pulsing green ring */}
        <div className="relative flex-shrink-0">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white text-base font-bold shadow-md">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={callerName}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <span>{getInitials(callerName)}</span>
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#181C24] animate-ping" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#181C24]" />
        </div>

        {/* Center: Caller info */}
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-white font-bold text-sm sm:text-base truncate leading-tight">
            {callerName}
          </h4>
          <p className="text-xs text-slate-300/90 truncate flex items-center gap-1.5 mt-0.5 font-medium">
            <Icon
              name={isVideo ? "videocam" : "call"}
              size="xs"
              className={isVideo ? "text-blue-400" : "text-emerald-400"}
            />
            <span>{isVideo ? "Incoming video call" : "Incoming voice call"}</span>
          </p>
        </div>

        {/* Right: Circular Decline & Accept Buttons (Matching Visual Reference Image 2) */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Decline Button */}
          <button
            onClick={onDecline}
            type="button"
            title="Decline"
            aria-label="Decline incoming call"
            className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all cursor-pointer"
          >
            <Icon name="call_end" size="sm" />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            type="button"
            title="Accept"
            aria-label="Accept incoming call"
            className="w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 transition-all cursor-pointer"
          >
            <Icon name={isVideo ? "videocam" : "call"} size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
};
