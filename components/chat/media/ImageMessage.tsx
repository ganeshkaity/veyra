"use client";

import React, { useState } from "react";
import { ChatMessage } from "@/types";
import { Icon } from "@/components/ui/Icon";

interface ImageMessageProps {
  message: ChatMessage;
  onOpenViewer: (message: ChatMessage) => void;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({
  message,
  onOpenViewer,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const quality = message.mediaQuality || "sd";
  const fileName = message.mediaMetadata?.fileName;

  return (
    <div
      onClick={() => !hasError && onOpenViewer(message)}
      className="relative rounded-2xl overflow-hidden cursor-pointer group mb-1.5 max-w-sm border border-black/5 dark:border-white/10 shadow-xs"
    >
      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <div className="w-64 h-52 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
          <Icon name="image" size="md" className="text-slate-400 opacity-50" />
        </div>
      )}

      {/* Error state */}
      {hasError ? (
        <div className="w-64 h-40 bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
          <Icon name="broken_image" size="md" className="mb-1 text-slate-400" />
          <span className="text-xs">Failed to load photo</span>
        </div>
      ) : (
        <div className="relative">
          <img
            src={message.mediaUrl}
            alt={fileName || "Photo"}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`w-full max-h-80 object-cover rounded-2xl transition-all duration-300 ${
              isLoaded ? "opacity-100 group-hover:scale-[1.02]" : "opacity-0 absolute inset-0"
            }`}
            loading="lazy"
          />

          {/* Quality Pill Badge */}
          {isLoaded && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-sm select-none">
              {quality.toUpperCase()}
            </div>
          )}

          {/* Hover overlay hint */}
          {isLoaded && (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <div className="w-9 h-9 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-lg">
                <Icon name="fullscreen" size="sm" />
              </div>
            </div>
          )}
        </div>
      )}

      {fileName && (
        <p className="text-[11px] text-slate-400 mt-1 px-1 truncate select-none">
          {fileName}
        </p>
      )}
    </div>
  );
};
