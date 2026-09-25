"use client";

import React, { useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { uploadImage, UploadedImageResult } from "@/lib/storage/imgbbService";
import { ChatMessage } from "@/types";

interface MediaAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendImage: (
    imageUrl: string,
    quality: "sd" | "hd",
    metadata?: ChatMessage["mediaMetadata"]
  ) => Promise<void>;
  initialFile?: File | null;
  initialComingSoon?: {
    title: string;
    description: string;
    icon: string;
  } | null;
}

export const MediaAttachmentModal: React.FC<MediaAttachmentModalProps> = ({
  isOpen,
  onClose,
  onSendImage,
  initialFile,
  initialComingSoon,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<"sd" | "hd">("sd");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [comingSoonFeature, setComingSoonFeature] = useState<{
    title: string;
    description: string;
    icon: string;
  } | null>(initialComingSoon || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with initialFile when opened
  React.useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile);
      const url = URL.createObjectURL(initialFile);
      setPreviewUrl(url);
    }
  }, [initialFile]);

  // Sync with initialComingSoon when opened
  React.useEffect(() => {
    if (initialComingSoon) {
      setComingSoonFeature(initialComingSoon);
    }
  }, [initialComingSoon]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Please select a valid image file.");
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setErrorMessage(null);
    }
  };

  const handleUploadAndSend = async () => {
    if (!selectedFile) return;
    try {
      setIsUploading(true);
      setErrorMessage(null);
      const result: UploadedImageResult = await uploadImage(selectedFile, quality);
      await onSendImage(result.url, quality, {
        width: result.width,
        height: result.height,
        sizeBytes: result.sizeBytes,
        mimeType: result.mimeType,
        fileName: result.fileName,
      });
      handleClose();
    } catch (err: any) {
      console.error("Failed to send image:", err);
      setErrorMessage(
        err.message || "Failed to upload image. Please check your connection and try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setComingSoonFeature(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Share Media" maxWidth="md">
      <div className="space-y-4">
        {/* Coming Soon Modal / Notice for Video, Document, Audio */}
        {comingSoonFeature && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-transparent border border-blue-500/20 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Icon name={comingSoonFeature.icon} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {comingSoonFeature.title} Sharing
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                    Coming Soon
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {comingSoonFeature.description}
                </p>
              </div>
              <button
                onClick={() => setComingSoonFeature(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        {!previewUrl ? (
          /* Attachment Options Grid */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
            {/* Functional Photo Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-blue-400 text-white flex items-center justify-center mb-2 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Icon name="photo_camera" size="md" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Photos
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">SD / HD Image</span>
            </button>

            {/* Video (Coming Soon) */}
            <button
              type="button"
              onClick={() =>
                setComingSoonFeature({
                  title: "Video",
                  description:
                    "High-definition video messaging and playback with streaming compression is arriving in an upcoming Veyra release.",
                  icon: "videocam",
                })
              }
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center mb-2 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <Icon name="videocam" size="md" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Video
              </span>
              <span className="text-[10px] text-amber-500 font-medium mt-0.5">Coming Soon</span>
            </button>

            {/* Document (Coming Soon) */}
            <button
              type="button"
              onClick={() =>
                setComingSoonFeature({
                  title: "Document",
                  description:
                    "Secure PDF, DOCX, and presentations sharing with preview cards will be enabled in the next update.",
                  icon: "description",
                })
              }
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-teal-500 text-white flex items-center justify-center mb-2 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Icon name="description" size="md" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Document
              </span>
              <span className="text-[10px] text-amber-500 font-medium mt-0.5">Coming Soon</span>
            </button>

            {/* Audio / Voice (Coming Soon) */}
            <button
              type="button"
              onClick={() =>
                setComingSoonFeature({
                  title: "Audio & Voice",
                  description:
                    "Voice notes, voice messaging with waveform visualizations, and audio files are under active development.",
                  icon: "mic",
                })
              }
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center mb-2 shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                <Icon name="mic" size="md" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Audio
              </span>
              <span className="text-[10px] text-amber-500 font-medium mt-0.5">Coming Soon</span>
            </button>
          </div>
        ) : (
          /* Image Preview & Quality Selector */
          <div className="space-y-4">
            <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-slate-900/90 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-inner">
              <img
                src={previewUrl}
                alt="Selected media preview"
                className="max-w-full max-h-full object-contain"
              />
              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-mono flex items-center gap-1.5">
                <Icon name="image" size="xs" />
                <span className="truncate max-w-[200px]">{selectedFile?.name}</span>
                <span className="opacity-60">•</span>
                <span>{selectedFile ? formatFileSize(selectedFile.size) : ""}</span>
              </div>
            </div>

            {/* Quality Picker: SD vs HD */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div>
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Sending Quality
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {quality === "sd"
                    ? "SD: Smart compressed (~300–500 KB, fast send, sharp visuals)"
                    : "HD: High definition original resolution preserved"}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-xs">
                <button
                  type="button"
                  onClick={() => setQuality("sd")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    quality === "sd"
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  SD
                </button>
                <button
                  type="button"
                  onClick={() => setQuality("hd")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    quality === "hd"
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  HD
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                Change Photo
              </Button>

              <Button
                variant="primary"
                size="sm"
                isLoading={isUploading}
                onClick={handleUploadAndSend}
                leftIcon={<Icon name="send" size="xs" />}
              >
                Send {quality.toUpperCase()} Photo
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </Modal>
  );
};
