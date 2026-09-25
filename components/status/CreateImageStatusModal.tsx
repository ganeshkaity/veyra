"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { UserProfile } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadImage } from "@/lib/storage/imgbbService";
import { createStatus } from "@/lib/firestore/statusService";

interface CreateImageStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onStatusCreated?: (statusId: string) => void;
}

export const CreateImageStatusModal: React.FC<CreateImageStatusModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onStatusCreated,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [quality, setQuality] = useState<"sd" | "hd">("sd");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith("image/")) {
        setError("Please choose a valid image file.");
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setError(null);
    }
  };

  const handleUploadAndPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image first.");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // 1. Upload to imgBB via server route
      const uploadRes = await uploadImage(file, quality);

      // 2. Publish to Firestore
      const statusId = await createStatus({
        userId: currentUser.uid,
        userDisplayName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatarUrl: currentUser.avatarUrl,
        type: "image",
        mediaUrl: uploadRes.url,
        content: caption.trim(),
        mediaMetadata: {
          width: uploadRes.width,
          height: uploadRes.height,
          sizeBytes: uploadRes.sizeBytes,
          mimeType: uploadRes.mimeType,
          fileName: uploadRes.fileName,
        },
      });

      handleClose();
      onStatusCreated?.(statusId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload photo status";
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewUrl(null);
    setCaption("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Photo Status"
      maxWidth="md"
    >
      <form onSubmit={handleUploadAndPublish} className="space-y-4">
        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {previewUrl ? (
          <div className="space-y-3">
            {/* Image Preview Box */}
            <div className="relative w-full h-64 rounded-2xl bg-black/90 overflow-hidden flex items-center justify-center">
              <Image
                src={previewUrl}
                alt="Status preview"
                fill
                className="object-contain"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-2 right-2 p-2 rounded-xl bg-black/60 text-white text-xs hover:bg-black/80 flex items-center gap-1 backdrop-blur-xs transition-colors"
              >
                <Icon name="swap_horiz" size="xs" />
                <span>Change</span>
              </button>
            </div>

            {/* Quality Selector (SD vs HD) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Upload Quality
              </span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuality("sd")}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    quality === "sd"
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  SD (Compressed)
                </button>
                <button
                  type="button"
                  onClick={() => setQuality("hd")}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    quality === "hd"
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  HD (Original)
                </button>
              </div>
            </div>

            {/* Caption Input */}
            <Input
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={120}
              leftIcon={<Icon name="short_text" size="xs" />}
            />
          </div>
        ) : (
          /* Empty Selection Box */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-56 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#2563EB] dark:hover:border-[#14B8A6] flex flex-col items-center justify-center cursor-pointer transition-colors p-6 text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/30"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 dark:bg-teal-500/10 text-[#2563EB] dark:text-[#14B8A6] flex items-center justify-center">
              <Icon name="add_photo_alternate" size="md" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Choose a photo to share
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                PNG, JPG, or WEBP. Uploaded securely via imgBB.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!file || isUploading}
            isLoading={isUploading}
          >
            Share Photo Status
          </Button>
        </div>
      </form>
    </Modal>
  );
};
