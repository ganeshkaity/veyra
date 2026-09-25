"use client";

import React, { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

export interface AttachmentMenuOption {
  id: "image" | "gif" | "sticker" | "video" | "document" | "audio";
  label: string;
  subtitle: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  isAvailable: boolean;
}

interface AttachmentMenuPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: () => void;
  onSelectGif: () => void;
  onSelectSticker: () => void;
  onSelectComingSoon: (title: string, description: string) => void;
}

export const AttachmentMenuPopover: React.FC<AttachmentMenuPopoverProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  onSelectGif,
  onSelectSticker,
  onSelectComingSoon,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
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

  const options: AttachmentMenuOption[] = [
    {
      id: "image",
      label: "Image",
      subtitle: "Photos & pictures (SD/HD)",
      icon: "image",
      colorClass: "text-[#2563EB] dark:text-[#60A5FA]",
      bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
      isAvailable: true,
    },
    {
      id: "gif",
      label: "GIF",
      subtitle: "GIPHY animated clips",
      icon: "gif_box",
      colorClass: "text-purple-600 dark:text-purple-400",
      bgClass: "bg-purple-500/10 dark:bg-purple-500/20",
      isAvailable: true,
    },
    {
      id: "sticker",
      label: "Sticker",
      subtitle: "Expressive stickers",
      icon: "sentiment_satisfied",
      colorClass: "text-teal-600 dark:text-teal-400",
      bgClass: "bg-teal-500/10 dark:bg-teal-500/20",
      isAvailable: true,
    },
    {
      id: "video",
      label: "Video",
      subtitle: "Clips & recordings",
      icon: "videocam",
      colorClass: "text-rose-500 dark:text-rose-400",
      bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
      isAvailable: false,
    },
    {
      id: "document",
      label: "Document",
      subtitle: "PDF, Word, files",
      icon: "description",
      colorClass: "text-indigo-500 dark:text-indigo-400",
      bgClass: "bg-indigo-500/10 dark:bg-indigo-500/20",
      isAvailable: false,
    },
    {
      id: "audio",
      label: "Audio",
      subtitle: "Voice & audio clips",
      icon: "mic",
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
      isAvailable: false,
    },
  ];

  const handleOptionClick = (option: AttachmentMenuOption) => {
    onClose();
    switch (option.id) {
      case "image":
        onSelectImage();
        break;
      case "gif":
        onSelectGif();
        break;
      case "sticker":
        onSelectSticker();
        break;
      case "video":
        onSelectComingSoon(
          "Video Messaging",
          "HD video messaging, previewing, and compression will be available in Veyra V2."
        );
        break;
      case "document":
        onSelectComingSoon(
          "Document Sharing",
          "Direct PDF, spreadsheet, and document file sharing will be available in Veyra V2."
        );
        break;
      case "audio":
        onSelectComingSoon(
          "Voice Messaging",
          "Voice notes, waveforms, and audio clips will be available in Veyra V2."
        );
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-3 left-2 sm:left-4 z-40 w-72 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{
        boxShadow:
          "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="p-2.5 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3">
        Share Media & Attachments
      </div>

      <div className="p-1.5 space-y-0.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleOptionClick(option)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
              option.isAvailable
                ? "hover:bg-slate-100 dark:hover:bg-slate-800/70 active:scale-[0.98]"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-80 hover:opacity-100"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl ${option.bgClass} ${option.colorClass} flex items-center justify-center flex-shrink-0 transition-transform`}
            >
              <Icon name={option.icon} size="sm" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {option.label}
                </span>
                {!option.isAvailable && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold tracking-tight">
                    Coming Soon
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {option.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
