"use client";

import React from "react";
import { ChatMessage } from "@/types";
import { MessageStatusTick } from "./MessageStatusTick";

interface CallMessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  formatTime: (ts: number) => string;
  onCallBack?: (isVideo: boolean) => void;
}

export const CallMessageBubble: React.FC<CallMessageBubbleProps> = ({
  message,
  isMe,
  formatTime,
  onCallBack,
}) => {
  const callInfo = message.callInfo;
  const isVideo =
    callInfo?.callType === "video" ||
    (message.text && /video/i.test(message.text));
  const isMissed =
    callInfo?.status === "missed" ||
    callInfo?.status === "declined" ||
    (message.text && /no answer|missed|declined/i.test(message.text));

  // Determine Title & Subtitle matching user's Image 2 reference
  let title = isVideo ? "Video call" : "Voice call";
  if (!isMe && isMissed) {
    title = isVideo ? "Missed video call" : "Missed voice call";
  }

  let subtitle = "No answer";
  if (isMissed) {
    subtitle = "No answer";
  } else if (callInfo?.duration && callInfo.duration > 0) {
    subtitle = callInfo.formattedDuration || `${Math.floor(callInfo.duration / 60)}:${String(callInfo.duration % 60).padStart(2, "0")} min`;
  } else if (callInfo?.subtitle) {
    subtitle = callInfo.subtitle;
  } else {
    subtitle = "Call ended";
  }

  return (
    <div
      onClick={() => onCallBack?.(Boolean(isVideo))}
      className={`relative inline-flex items-center min-w-[240px] max-w-[340px] sm:max-w-[380px] p-3 px-4 rounded-2xl shadow-md transition-all select-none cursor-pointer group ${
        isMe
          ? "bg-[#005c4b] text-white rounded-tr-sm"
          : "bg-[#005c4b] dark:bg-[#1f2c34] text-white rounded-tl-sm border border-emerald-900/30 dark:border-slate-800"
      }`}
      title={onCallBack ? "Tap to call back" : undefined}
    >
      {/* Speech bubble tail for WhatsApp authentic look matching Image 2 */}
      {isMe ? (
        <svg
          className="absolute -top-0 -right-2 w-2.5 h-3 text-[#005c4b] fill-current pointer-events-none"
          viewBox="0 0 10 12"
        >
          <path d="M0,0 C3,1 8,4 10,12 C10,5 5,1 0,0 Z" />
        </svg>
      ) : (
        <svg
          className="absolute -top-0 -left-2 w-2.5 h-3 text-[#005c4b] dark:text-[#1f2c34] fill-current pointer-events-none -scale-x-100"
          viewBox="0 0 10 12"
        >
          <path d="M0,0 C3,1 8,4 10,12 C10,5 5,1 0,0 Z" />
        </svg>
      )}

      {/* Circular icon container */}
      <div
        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 mr-3.5 shadow-inner ${
          !isMe && isMissed
            ? "bg-[#0a463b] text-rose-400"
            : "bg-[#024338] text-white"
        }`}
      >
        {isVideo ? (
          // Video Call Icon
          <div className="relative">
            <svg
              className="w-5 h-5 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            {/* Arrow Badge */}
            <span className="absolute -top-1 -right-1 text-[9px] font-black">
              {isMe ? "↗" : "↙"}
            </span>
          </div>
        ) : (
          // Voice Call Icon with arrow matching Image 2
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 fill-current"
            viewBox="0 0 24 24"
          >
            {/* Phone receiver */}
            <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            {/* Arrow symbol: Outgoing (top-right ↗) or Incoming/Missed (bottom-left ↙) */}
            {isMe ? (
              <path
                d="M15 4h5v5m0-5l-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M9 20H4v-5m0 5l6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        )}
      </div>

      {/* Middle column: Title and Subtitle */}
      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-[16px] sm:text-[17px] font-bold text-white tracking-tight leading-tight truncate">
          {title}
        </h4>
        <p className="text-[13.5px] text-white/70 font-medium leading-tight mt-0.5 truncate">
          {subtitle}
        </p>
      </div>

      {/* Right column: Timestamp & delivery ticks */}
      <div className="flex items-center gap-1 self-end pb-0.5 ml-2 flex-shrink-0 select-none">
        <span className="text-[11.5px] text-white/60 font-normal">
          {formatTime(message.createdAt)}
        </span>
        {isMe && (
          <MessageStatusTick
            status={message.status}
            size={16}
            className="text-emerald-200/80"
          />
        )}
      </div>
    </div>
  );
};
