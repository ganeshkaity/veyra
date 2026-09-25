"use client";

import React from "react";
import { ChatMessage } from "@/types";

interface StickerMessageProps {
  message: ChatMessage;
}

export const StickerMessage: React.FC<StickerMessageProps> = ({ message }) => {
  const stickerUrl =
    message.mediaUrl || (message.text?.startsWith("http") ? message.text : null);

  return (
    <div className="py-1 px-1 my-0.5 select-none transition-transform hover:scale-105 inline-block">
      {stickerUrl ? (
        <img
          src={stickerUrl}
          alt={message.text || "Sticker"}
          className="w-32 h-32 sm:w-36 sm:h-36 object-contain filter drop-shadow-sm"
          loading="lazy"
        />
      ) : (
        <span className="text-6xl leading-none inline-block filter drop-shadow-sm">
          {message.text}
        </span>
      )}
    </div>
  );
};
