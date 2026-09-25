"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ChatMessage } from "@/types";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  message,
}) => {
  const [scale, setScale] = useState(1);

  // Reset zoom on open
  useEffect(() => {
    if (isOpen) {
      setScale(1);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !message || !message.mediaUrl) return null;

  const fileName = message.mediaMetadata?.fileName || "photo.jpg";
  const quality = message.mediaQuality || "sd";

  const handleDownload = async () => {
    try {
      const response = await fetch(message.mediaUrl!);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (_) {
      window.open(message.mediaUrl, "_blank");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      {/* Top Header Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent text-white z-20"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">
                {message.senderName || "Photo"}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-bold uppercase tracking-wider">
                {quality.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-white/60 truncate font-mono">
              {new Date(message.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom In/Out */}
          <button
            type="button"
            onClick={() => setScale((s) => (s >= 2 ? 1 : s + 0.5))}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title="Zoom"
          >
            <Icon name={scale > 1 ? "zoom_out" : "zoom_in"} size="sm" />
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title="Download image"
          >
            <Icon name="download" size="sm" />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-colors ml-1"
            title="Close viewer (Esc)"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        onClick={onClose}
        className="flex-1 flex items-center justify-center p-4 overflow-hidden relative cursor-zoom-out"
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            setScale((s) => (s >= 2 ? 1 : s + 0.5));
          }}
          className="relative max-w-full max-h-full transition-transform duration-200 cursor-zoom-in flex items-center justify-center"
          style={{ transform: `scale(${scale})` }}
        >
          <img
            src={message.mediaUrl}
            alt={fileName}
            className="max-h-[82vh] max-w-[92vw] object-contain rounded-xl shadow-2xl"
          />
        </div>
      </div>

      {/* Bottom Metadata Bar */}
      {message.mediaMetadata && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="p-3 text-center text-xs text-white/60 bg-gradient-to-t from-black/80 to-transparent z-20 font-mono"
        >
          {message.mediaMetadata.width && message.mediaMetadata.height && (
            <span>
              {message.mediaMetadata.width} × {message.mediaMetadata.height} px
            </span>
          )}
          {message.mediaMetadata.sizeBytes && (
            <span className="ml-2">
              • {(message.mediaMetadata.sizeBytes / 1024).toFixed(0)} KB
            </span>
          )}
        </div>
      )}
    </div>
  );
};
