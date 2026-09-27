"use client";

import React, { useState } from "react";
import { ChatMessage } from "@/types";
import { Icon } from "@/components/ui/Icon";

interface ImageMessageProps {
  message: ChatMessage;
  onOpenViewer: (message: ChatMessage, initialIndex?: number) => void;
  hasCaption?: boolean;
  children?: React.ReactNode;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({
  message,
  onOpenViewer,
  hasCaption = false,
  children,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const quality = message.mediaQuality || "sd";
  const fileName = message.mediaMetadata?.fileName;

  const images: string[] =
    message.mediaUrls && message.mediaUrls.length > 0
      ? message.mediaUrls
      : message.mediaUrl
      ? [message.mediaUrl]
      : [];

  const isMulti = images.length > 1;

  // Collage Rendering for Multiple Images (<=49 images, Image 3 style)
  if (isMulti) {
    const displayCount = Math.min(images.length, 4);
    const remainingCount = images.length - 3; // In a 4-cell layout, cell 4 shows remaining

    return (
      <div
        onClick={() => onOpenViewer(message, 0)}
        className={`relative rounded-2xl overflow-hidden cursor-pointer group max-w-sm border border-black/5 dark:border-white/10 shadow-xs ${
          hasCaption ? "mb-1.5" : "mb-0"
        }`}
      >
        {/* Collage Grid */}
        <div
          className={`grid gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-2xl ${
            images.length === 2
              ? "grid-cols-2 h-48"
              : images.length === 3
              ? "grid-cols-2 grid-rows-2 h-64"
              : "grid-cols-2 grid-rows-2 h-72"
          }`}
        >
          {images.slice(0, displayCount).map((url, idx) => {
            const isLastOfFour = idx === 3 && images.length > 4;
            const spanClass =
              images.length === 3 && idx === 0 ? "col-span-2 row-span-1" : "";

            return (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenViewer(message, idx);
                }}
                className={`relative overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800 ${spanClass}`}
              >
                <img
                  src={url}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* +N Remaining Overlay on the last visible photo (Image 3 reference) */}
                {isLastOfFour && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex items-center justify-center text-white text-3xl font-extrabold shadow-inner select-none transition-colors group-hover:bg-black/55">
                    + {remainingCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quality Pill Badge */}
        <div className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-sm select-none z-10">
          {quality.toUpperCase()}
        </div>

        {/* Floating Timestamp & Checkmark in bottom right */}
        {children}
      </div>
    );
  }

  // Single Image Rendering
  return (
    <div
      onClick={() => !hasError && onOpenViewer(message)}
      className={`relative rounded-2xl overflow-hidden cursor-pointer group max-w-sm border border-black/5 dark:border-white/10 shadow-xs ${
        hasCaption ? "mb-1.5" : "mb-0"
      }`}
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
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-sm select-none z-10">
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

          {/* Floating overlay (e.g. timestamp & ticks when no caption) */}
          {children}
        </div>
      )}

      {hasCaption && fileName && (
        <p className="text-[11px] text-slate-400 mt-1 px-1 truncate select-none">
          {fileName}
        </p>
      )}
    </div>
  );
};
