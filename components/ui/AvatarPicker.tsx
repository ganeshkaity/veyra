"use client";

import React, { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { uploadAvatar } from "@/lib/storage/imgbbService";

interface AvatarPickerProps {
  currentAvatarUrl?: string;
  displayName: string;
  onAvatarChange: (newUrl: string) => void;
  size?: "md" | "lg" | "xl";
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
];

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  currentAvatarUrl,
  displayName,
  onAvatarChange,
  size = "xl",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      // Upload to imgBB with 100-150 KB high-clarity compression
      const { url } = await uploadAvatar(file);
      onAvatarChange(url);
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      setUploadError(err.message || "Failed to upload avatar. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar
          name={displayName || "User"}
          src={currentAvatarUrl}
          size={size}
          className="shadow-md"
        />

        {/* Change button overlay */}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          title="Change profile picture"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Icon name="photo_camera" size="sm" />
              <span className="text-[10px] font-semibold mt-0.5">Upload</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#2563EB] text-white shadow-md hover:scale-105 active:scale-95 transition-transform border-2 border-white dark:border-slate-900"
          title="Upload photo"
        >
          <Icon name="photo_camera" size="xs" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-semibold text-[#2563EB] dark:text-[#14B8A6] hover:underline"
        >
          Upload Photo
        </button>
        <span className="text-slate-300 dark:text-slate-700">•</span>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          {showPresets ? "Hide Presets" : "Choose Preset"}
        </button>
      </div>

      {uploadError && (
        <div className="text-[11px] text-red-500 font-medium max-w-xs text-center px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/30">
          {uploadError}
        </div>
      )}

      {showPresets && (
        <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto max-w-xs animate-in fade-in zoom-in-95 duration-150">
          {PRESET_AVATARS.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onAvatarChange(url);
                setShowPresets(false);
              }}
              className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 hover:scale-110 active:scale-95 transition-transform border-2 border-transparent hover:border-[#2563EB]"
            >
              <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
};
