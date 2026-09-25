"use client";

import React, { useState } from "react";
import { ChatMessage } from "@/types";
import { Icon } from "@/components/ui/Icon";

interface GifMessageProps {
  message: ChatMessage;
  hasCaption?: boolean;
  children?: React.ReactNode;
}

export const GifMessage: React.FC<GifMessageProps> = ({
  message,
  hasCaption = false,
  children,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden max-w-xs shadow-xs border border-white/5 dark:border-white/10 group ${
        hasCaption ? "mb-1.5" : "mb-0"
      }`}
    >
      {!isLoaded && (
        <div className="w-56 h-44 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
          <Icon name="gif_box" size="md" className="text-slate-400 opacity-50" />
        </div>
      )}

      <div className="relative">
        <img
          src={message.mediaUrl}
          alt="GIF"
          onLoad={() => setIsLoaded(true)}
          className={`w-full max-h-72 object-contain rounded-2xl ${
            isLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
          }`}
          loading="lazy"
        />

        {isLoaded && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-wider select-none shadow-sm z-10">
            GIF
          </div>
        )}

        {/* Floating overlay (timestamp & ticks when no caption) */}
        {children}
      </div>
    </div>
  );
};
