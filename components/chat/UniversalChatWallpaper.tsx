"use client";

import React from "react";

interface UniversalChatWallpaperProps {
  customWallpaperUrl?: string | null;
  children: React.ReactNode;
  className?: string;
  isAiConversation?: boolean;
}

/**
 * UniversalChatWallpaper
 *
 * Implements Veyra's layered universal chat wallpaper architecture:
 * Layer 1: Base Theme Color (light: #eae6df, dark: #0b1120)
 * Layer 2: Wallpaper Image Layer (Default Doodle Sticker Pattern from /assets/chatbg.png OR User Custom Wallpaper)
 * Layer 3: Translucent Readability Veil (ensures 100% text readability over any wallpaper)
 * Layer 4: Conversation Content (Message bubbles, inputs, headers)
 *
 * This wallpaper applies globally to all one-on-one and group conversations.
 */
export const UniversalChatWallpaper: React.FC<UniversalChatWallpaperProps> = ({
  customWallpaperUrl,
  children,
  className = "",
  isAiConversation = false,
}) => {
  const isCustom = Boolean(
    customWallpaperUrl &&
    customWallpaperUrl !== "default" &&
    customWallpaperUrl.trim() !== ""
  );

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${className}`}>
      {/* Layer 1: Base Background Color */}
      <div className="absolute inset-0 universal-chat-wallpaper-base pointer-events-none" />

      {/* Layer 2: Image Layer (Default repeating doodle vs Custom uploaded wallpaper) */}
      {isCustom ? (
        <div
          className="absolute inset-0 universal-chat-custom-layer pointer-events-none"
          style={{
            backgroundImage: `url("${customWallpaperUrl}")`,
          }}
        />
      ) : (
        <div className="absolute inset-0 universal-chat-doodle-layer pointer-events-none" />
      )}

      {/* Layer 3: Subtle Translucent Readability Veil */}
      {isCustom ? (
        <div className="absolute inset-0 bg-white/20 dark:bg-slate-950/45 pointer-events-none universal-chat-veil" />
      ) : (
        <div className="absolute inset-0 bg-white/5 dark:bg-black/15 pointer-events-none universal-chat-veil" />
      )}

      {/* Optional AI Companion Tint Layer */}
      {isAiConversation && (
        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Layer 4: Conversation Content (Positioned firmly above wallpaper layers) */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
};
