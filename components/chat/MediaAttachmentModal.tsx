"use client";

import React, { useState, useRef, useEffect } from "react";
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
    metadata?: ChatMessage["mediaMetadata"],
    caption?: string,
    additionalUrls?: string[]
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [quality, setQuality] = useState<"sd" | "hd">("sd");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [comingSoonFeature, setComingSoonFeature] = useState<{
    title: string;
    description: string;
    icon: string;
  } | null>(initialComingSoon || null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pushedHistoryRef = useRef(false);

  // Requirement 7: Back key / backward navigation closes ONLY this modal
  useEffect(() => {
    if (!isOpen) {
      pushedHistoryRef.current = false;
      return;
    }

    if (typeof window !== "undefined") {
      const stateObj = { ...(window.history.state || {}), modal: "mediaAttachment" };
      window.history.pushState(stateObj, "", window.location.href);
      pushedHistoryRef.current = true;
    }

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      pushedHistoryRef.current = false;
      handleClose();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => {
      window.removeEventListener("popstate", handlePopState, true);
    };
  }, [isOpen]);

  // Sync initialFile
  useEffect(() => {
    if (initialFile) {
      setSelectedFiles([initialFile]);
      const url = URL.createObjectURL(initialFile);
      setPreviewUrls([url]);
      setActivePreviewIndex(0);
    }
  }, [initialFile]);

  // Sync initialComingSoon
  useEffect(() => {
    if (initialComingSoon) {
      setComingSoonFeature(initialComingSoon);
    }
  }, [initialComingSoon]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validImages = files.filter((f) => f.type.startsWith("image/"));
    if (validImages.length === 0) {
      setErrorMessage("Please select valid image files.");
      return;
    }

    const combined = [...selectedFiles, ...validImages];
    if (combined.length > 49) {
      setErrorMessage("You can select up to 49 images. The first 49 images have been selected.");
    } else {
      setErrorMessage(null);
    }

    const capped = combined.slice(0, 49);
    setSelectedFiles(capped);
    const urls = capped.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    if (activePreviewIndex >= capped.length) {
      setActivePreviewIndex(0);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    if (activePreviewIndex >= newFiles.length) {
      setActivePreviewIndex(Math.max(0, newFiles.length - 1));
    }
  };

  const handleUploadAndSend = async () => {
    if (selectedFiles.length === 0) return;
    try {
      setIsUploading(true);
      setErrorMessage(null);
      setUploadProgress({ current: 0, total: selectedFiles.length });

      const uploadedResults: UploadedImageResult[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: selectedFiles.length });
        const res = await uploadImage(selectedFiles[i], quality);
        uploadedResults.push(res);
      }

      const primary = uploadedResults[0];
      const additional = uploadedResults.slice(1).map((r) => r.url);

      await onSendImage(
        primary.url,
        quality,
        {
          width: primary.width,
          height: primary.height,
          sizeBytes: primary.sizeBytes,
          mimeType: primary.mimeType,
          fileName: primary.fileName,
        },
        caption.trim() || undefined,
        additional.length > 0 ? additional : undefined
      );

      handleClose();
    } catch (err: any) {
      console.error("Failed to send images:", err);
      setErrorMessage(
        err.message || "Failed to upload images. Please check your connection and try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setActivePreviewIndex(0);
    setCaption("");
    setComingSoonFeature(null);
    setErrorMessage(null);

    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Share Media" maxWidth="lg">
      <div className="space-y-4">
        {/* Coming Soon Notice */}
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

        {selectedFiles.length === 0 ? (
          /* Attachment Options Grid */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
            {/* Functional Multi-Photo Upload (up to 49 images) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-blue-400 text-white flex items-center justify-center mb-2 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Icon name="photo_camera" size="md" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Photos
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Up to 49 images</span>
            </button>

            {/* Video (Coming Soon) */}
            <button
              type="button"
              onClick={() =>
                setComingSoonFeature({
                  title: "Video",
                  description:
                    "High-definition video messaging and playback is arriving in an upcoming Veyra release.",
                  icon: "videocam",
                })
              }
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group cursor-pointer"
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
                    "Secure PDF, DOCX, and file sharing with preview cards will be enabled in the next update.",
                  icon: "description",
                })
              }
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group cursor-pointer"
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
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group cursor-pointer"
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
          /* Multi-image Preview, Thumbnails Strip, Caption, Quality Selector */
          <div className="space-y-4">
            {/* Active Image Large Preview */}
            <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-inner">
              {previewUrls[activePreviewIndex] && (
                <img
                  src={previewUrls[activePreviewIndex]}
                  alt={`Preview ${activePreviewIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              )}

              {/* Top pill with count and file name */}
              <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-black/65 backdrop-blur-md text-white text-xs font-medium flex items-center gap-2">
                <span>
                  {activePreviewIndex + 1} / {selectedFiles.length}
                </span>
                <span className="opacity-50">•</span>
                <span className="truncate max-w-[150px] font-mono text-[11px]">
                  {selectedFiles[activePreviewIndex]?.name}
                </span>
              </div>

              {/* Remove active button */}
              <button
                type="button"
                onClick={() => handleRemoveImage(activePreviewIndex)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/65 hover:bg-red-600 text-white backdrop-blur-md transition-colors"
                title="Remove this image"
              >
                <Icon name="delete" size="xs" />
              </button>
            </div>

            {/* Thumbnail Reel (slidable / scrollable) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
              {previewUrls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setActivePreviewIndex(idx)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer border-2 transition-all ${
                    idx === activePreviewIndex
                      ? "border-[#2563EB] scale-105 shadow-md"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(idx);
                    }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center text-[10px] hover:bg-red-600 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add more button (if < 49) */}
              {selectedFiles.length < 49 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#2563EB] dark:hover:border-[#2563EB] flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-[#2563EB] transition-colors flex-shrink-0 cursor-pointer"
                  title="Add more photos"
                >
                  <Icon name="add" size="sm" />
                  <span className="text-[10px] font-semibold mt-0.5">Add</span>
                </button>
              )}
            </div>

            {/* Caption Input */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Add a caption
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption for your images..."
                  maxLength={500}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#2563EB] transition-all pr-12"
                />
                <span className="absolute right-3 text-[11px] text-slate-400 font-mono">
                  {caption.length}/500
                </span>
              </div>
            </div>

            {/* Quality Picker & File Summary */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {selectedFiles.length} {selectedFiles.length === 1 ? "Image" : "Images"} Selected
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Total size:{" "}
                  {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
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
                  previewUrls.forEach((u) => URL.revokeObjectURL(u));
                  setSelectedFiles([]);
                  setPreviewUrls([]);
                }}
              >
                Clear All
              </Button>

              <Button
                variant="primary"
                size="sm"
                isLoading={isUploading}
                onClick={handleUploadAndSend}
                leftIcon={<Icon name="send" size="xs" />}
              >
                {isUploading
                  ? `Uploading (${uploadProgress.current}/${uploadProgress.total})...`
                  : `Send ${selectedFiles.length} ${
                      selectedFiles.length === 1 ? "Photo" : "Photos"
                    }`}
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesChange}
        />
      </div>
    </Modal>
  );
};
