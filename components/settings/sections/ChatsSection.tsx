"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { updateUserProfile } from "@/lib/firestore/userService";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAlert } from "@/components/providers/AlertModalProvider";
import { uploadImage } from "@/lib/storage/imgbbService";
import { WallpaperPreviewModal } from "../wallpaper/WallpaperPreviewModal";

interface ChatsSectionProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export const ChatsSection: React.FC<ChatsSectionProps> = ({
  currentUser,
  onBack,
}) => {
  const { refreshProfile } = useAuth();
  const { showAlert } = useAlert();
  const [wallpaper, setWallpaper] = useState<string>(
    currentUser.chatWallpaper || "default"
  );
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [isUpdatingWallpaper, setIsUpdatingWallpaper] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Wallpaper Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewWallpaperUrl, setPreviewWallpaperUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Other chat preferences
  const [enterIsSend, setEnterIsSend] = useState<boolean>(
    currentUser.enterIsSend !== false
  );
  const [mediaAutoDownload, setMediaAutoDownload] = useState<boolean>(
    currentUser.mediaAutoDownload !== false
  );

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    actionText: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isCustomActive = Boolean(
    wallpaper && wallpaper !== "default" && wallpaper.trim() !== ""
  );

  // Open preview for Default Veyra Wallpaper
  const handlePreviewDefault = () => {
    setPreviewWallpaperUrl("default");
    setPreviewFile(null);
    setPreviewModalOpen(true);
  };

  // Trigger file selection for Custom Wallpaper
  const handleSelectCustomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAlert("Please choose a valid image file (PNG, JPG, WebP).", {
        title: "Invalid File Type",
        type: "warning",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showAlert("File size exceeds 10MB limit. Please select a smaller image.", {
        title: "File Too Large",
        type: "warning",
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewWallpaperUrl(objectUrl);
    setPreviewFile(file);
    setPreviewModalOpen(true);
    e.target.value = "";
  };

  // Revert directly to Default Veyra Wallpaper
  const handleRevertToDefault = async () => {
    try {
      setIsUpdatingWallpaper(true);
      setWallpaper("default");
      await updateUserProfile(currentUser.uid, {
        chatWallpaper: "default",
      });
      if (typeof window !== "undefined") {
        localStorage.removeItem(`veyra_wallpaper_${currentUser.uid}`);
      }
      await refreshProfile();
      setPreviewModalOpen(false);
      showToast("Default Veyra wallpaper restored universally.");
    } catch (err) {
      console.error("Failed to restore default wallpaper:", err);
      showAlert("Failed to restore default wallpaper. Please try again.", {
        type: "error",
      });
    } finally {
      setIsUpdatingWallpaper(false);
    }
  };

  // Apply previewed wallpaper (either default or custom file)
  const handleApplyPreview = async () => {
    try {
      setIsUpdatingWallpaper(true);

      if (!previewFile && (previewWallpaperUrl === "default" || !previewWallpaperUrl)) {
        // Applying default
        await handleRevertToDefault();
        return;
      }

      if (previewFile) {
        // Upload custom image using the existing imgBB service
        const uploadResult = await uploadImage(previewFile, "hd");
        const finalUrl = uploadResult.url;

        // Persist to user profile and local cache
        await updateUserProfile(currentUser.uid, {
          chatWallpaper: finalUrl,
        });

        if (typeof window !== "undefined") {
          localStorage.setItem(`veyra_wallpaper_${currentUser.uid}`, finalUrl);
        }

        setWallpaper(finalUrl);
        await refreshProfile();
        setPreviewModalOpen(false);
        showToast("Custom wallpaper applied universally across all chats!");
      }
    } catch (err: unknown) {
      console.error("Failed to apply wallpaper:", err);
      const msg = err instanceof Error ? err.message : "Failed to apply wallpaper";
      showAlert(`${msg}. Please try again.`, { type: "error" });
    } finally {
      setIsUpdatingWallpaper(false);
    }
  };

  // Preference updates
  const handleToggleEnterIsSend = async () => {
    const val = !enterIsSend;
    setEnterIsSend(val);
    try {
      await updateUserProfile(currentUser.uid, { enterIsSend: val });
      await refreshProfile();
    } catch {}
  };

  const handleToggleAutoDownload = async () => {
    const val = !mediaAutoDownload;
    setMediaAutoDownload(val);
    try {
      await updateUserProfile(currentUser.uid, { mediaAutoDownload: val });
      await refreshProfile();
    } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 flex items-center gap-2">
          <Icon name="check_circle" size="xs" className="text-teal-400 dark:text-teal-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Settings</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          Chats
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5 pb-24 md:pb-12">
        {/* Section 1: Universal Chat Wallpaper Manager */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Universal Chat Wallpaper
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Applied to all one-on-one and group conversations.
              </p>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[11px] font-semibold text-[#2563EB] dark:text-[#14B8A6]">
              <Icon name="wallpaper" size="xs" />
              <span>{isCustomActive ? "Custom" : "Default"}</span>
            </div>
          </div>

          {/* Current Wallpaper Preview Strip */}
          <div className="relative h-28 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between p-4 shadow-inner">
            {/* Background Layer */}
            <div className="absolute inset-0 universal-chat-wallpaper-base" />
            {isCustomActive ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url("${wallpaper}")` }}
              />
            ) : (
              <div
                className="absolute inset-0 universal-chat-doodle-layer"
                style={{
                  backgroundImage: "url('/assets/chatbg.png')",
                  backgroundRepeat: "repeat",
                  backgroundSize: "320px",
                }}
              />
            )}
            <div className="absolute inset-0 bg-white/10 dark:bg-black/25 pointer-events-none" />

            {/* Foreground Info */}
            <div className="relative z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2.5 px-3.5 rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm max-w-[220px]">
              <span className="block text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {isCustomActive ? "Custom Wallpaper" : "Default Veyra Doodle"}
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {isCustomActive
                  ? "Universal user wallpaper"
                  : "Theme-adaptive sticker pattern"}
              </span>
            </div>

            <div className="relative z-10 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-xs shadow-xs"
                onClick={() => setShowWallpaperModal(true)}
              >
                Change
              </Button>
            </div>
          </div>

          {/* Quick Action Buttons: Default / Upload / Revert */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* 1. Default Veyra Wallpaper */}
            <button
              type="button"
              onClick={handlePreviewDefault}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center group active:scale-98"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-[#14B8A6] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Icon name="auto_awesome" size="xs" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Default Doodle
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Preview & Apply</span>
            </button>

            {/* 2. Upload Wallpaper */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/30 transition-all text-center group active:scale-98"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-[#2563EB] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Icon name="upload" size="xs" />
              </div>
              <span className="text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                Upload Photo
              </span>
              <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                From Device
              </span>
            </button>

            {/* 3. Revert to Default */}
            <button
              type="button"
              disabled={!isCustomActive || isUpdatingWallpaper}
              onClick={handleRevertToDefault}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center active:scale-98 ${
                isCustomActive
                  ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 cursor-pointer"
                  : "border-slate-100 dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-900/20 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5">
                <Icon name="restart_alt" size="xs" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Use Default
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Revert Custom</span>
            </button>
          </div>
        </div>

        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSelectCustomFile}
        />

        {/* Section 2: Chat Input Preferences & Auto Download */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-4">
          {/* Enter is Send */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Enter is Send
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pressing Enter sends your message (Shift+Enter for newline)
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enterIsSend}
              onClick={handleToggleEnterIsSend}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                enterIsSend ? "bg-[#2563EB]" : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enterIsSend ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            {/* Media Auto Download */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Media Auto-Download
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Automatically load stickers, GIFs, and image thumbnails
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={mediaAutoDownload}
                onClick={handleToggleAutoDownload}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  mediaAutoDownload ? "bg-[#2563EB]" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mediaAutoDownload ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Conversation Management */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                title: "Archive All Chats",
                description:
                  "Are you sure you want to archive all your chats? They will remain accessible anytime.",
                actionText: "Archive All",
              })
            }
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-sm font-medium text-[#2563EB] dark:text-[#14B8A6]">
              Archive All Chats
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                title: "Clear All Chats",
                description:
                  "Clearing will delete all messages inside your direct conversations for your account only.",
                actionText: "Clear All",
              })
            }
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
          >
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Clear All Chats
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                title: "Delete All Chats",
                description:
                  "Deleting all chats removes conversations from your chat list.",
                actionText: "Delete All",
              })
            }
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
          >
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Delete All Chats
            </span>
          </button>
        </div>
      </div>

      {/* Change Wallpaper Hub Modal */}
      <Modal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        title="Universal Chat Wallpaper"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Veyra uses one universal wallpaper across all your one-to-one and group conversations. Choose between the signature doodle pattern or upload your own photo:
          </p>

          <div className="space-y-3">
            {/* Option 1: Default Veyra Wallpaper */}
            <div
              onClick={() => {
                setShowWallpaperModal(false);
                handlePreviewDefault();
              }}
              className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#2563EB] dark:hover:border-[#14B8A6] hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden relative shadow-xs flex-shrink-0">
                  <div className="absolute inset-0 bg-[#EAE6DF] dark:bg-[#0B1120]" />
                  <div
                    className="absolute inset-0 universal-chat-doodle-layer"
                    style={{
                      backgroundImage: "url('/assets/chatbg.png')",
                      backgroundRepeat: "repeat",
                      backgroundSize: "240px",
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#2563EB] dark:group-hover:text-[#14B8A6] transition-colors">
                      Default Veyra Wallpaper
                    </h4>
                    {!isCustomActive && (
                      <span className="px-2 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Signature transparent doodle sticker pattern on adaptive canvas.
                  </p>
                </div>
              </div>

              <Button size="sm" variant="ghost" className="text-xs">
                Preview
              </Button>
            </div>

            {/* Option 2: Upload Custom Wallpaper */}
            <div
              onClick={() => {
                setShowWallpaperModal(false);
                fileInputRef.current?.click();
              }}
              className="flex items-center justify-between p-3.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10 hover:border-[#2563EB] hover:bg-blue-50/70 dark:hover:bg-blue-950/20 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <Icon name="add_photo_alternate" size="sm" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#2563EB] dark:group-hover:text-[#14B8A6] transition-colors">
                    Upload Wallpaper
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Select any picture from your device with live conversation preview.
                  </p>
                </div>
              </div>

              <Button size="sm" variant="primary" className="text-xs">
                Upload
              </Button>
            </div>

            {/* Option 3: Revert to Default */}
            {isCustomActive && (
              <div
                onClick={() => {
                  setShowWallpaperModal(false);
                  handleRevertToDefault();
                }}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/70 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs flex-shrink-0">
                    <Icon name="restart_alt" size="sm" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Use Default Wallpaper
                    </h4>
                    <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                      Remove your custom wallpaper and restore the default doodle.
                    </p>
                  </div>
                </div>

                <Button size="sm" variant="outline" className="text-xs border-amber-300 dark:border-amber-700">
                  Revert
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowWallpaperModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Live Interactive Wallpaper Preview Modal */}
      <WallpaperPreviewModal
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          setPreviewFile(null);
        }}
        previewUrl={previewWallpaperUrl}
        isCustom={Boolean(previewFile || (previewWallpaperUrl && previewWallpaperUrl !== "default"))}
        onApply={handleApplyPreview}
        onRevertToDefault={handleRevertToDefault}
        isApplying={isUpdatingWallpaper}
      />

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title || ""}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {confirmModal?.description}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmModal(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                showToast(`${confirmModal?.actionText} completed.`);
                setConfirmModal(null);
              }}
            >
              {confirmModal?.actionText}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
