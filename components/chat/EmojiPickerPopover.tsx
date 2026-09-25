"use client";

import React, { useEffect, useRef } from "react";
import emojiData from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 z-50 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
    >
      <Picker
        data={emojiData}
        onEmojiSelect={(emoji: any) => {
          onSelectEmoji(emoji.native);
        }}
        theme="dark"
        previewPosition="none"
        skinTonePosition="search"
        navPosition="top"
        searchPosition="sticky"
        maxFrequentRows={1}
      />
    </div>
  );
};
