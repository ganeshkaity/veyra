"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { createChannel } from "@/lib/firestore/channelService";
import { Channel } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channel: Channel) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onChannelCreated,
}) => {
  const { user, profile } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isHistoryPushedRef = useRef(false);

  // History & Back button management (back closes modal only, without page refresh or leaving explore)
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setAvatarPreview(null);
      setAvatarFile(null);
      setErrorMsg(null);
      setIsSubmitting(false);
      return;
    }

    // Push dummy history entry for backward button interception
    if (typeof window !== "undefined") {
      window.history.pushState({ channelModal: "create" }, "");
      isHistoryPushedRef.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      isHistoryPushedRef.current = false;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSafeClose();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSafeClose = () => {
    if (isHistoryPushedRef.current && typeof window !== "undefined") {
      isHistoryPushedRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size must be less than 5MB");
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter a channel name");
      return;
    }
    if (!user || !profile) {
      setErrorMsg("You must be logged in to create a channel");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      let finalAvatarUrl = avatarPreview || "";

      // Create channel in Firestore
      const newChannel = await createChannel(
        name.trim(),
        description.trim(),
        finalAvatarUrl,
        profile
      );

      // Cleanly close modal without triggering explore page back navigation
      if (isHistoryPushedRef.current && typeof window !== "undefined") {
        isHistoryPushedRef.current = false;
        window.history.back();
      }
      onChannelCreated(newChannel);
    } catch (err: any) {
      console.error("Failed to create channel:", err);
      setErrorMsg(err.message || "Failed to create channel. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleSafeClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white dark:bg-[#0F172A] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#2563EB] flex items-center justify-center">
              <Icon name="campaign" size="sm" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              New Channel
            </h3>
          </div>
          <button
            type="button"
            onClick={handleSafeClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#2563EB] flex items-center justify-center cursor-pointer overflow-hidden transition-all group shadow-sm"
              title="Upload channel icon"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Channel Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-slate-400 group-hover:text-[#2563EB] transition-colors">
                  <Icon name="add_a_photo" size="md" />
                  <span className="text-[10px] font-semibold mt-1">Add icon</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Icon name="edit" size="sm" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <span className="text-[11px] text-slate-400 mt-2">
              Recommended: 500x500 square photo
            </span>
          </div>

          {/* Channel Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Channel Name <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">{name.length}/60</span>
            </div>
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Tech Highlights, Book Club"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] transition-all"
            />
          </div>

          {/* Channel Bio/Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Description / Bio
              </label>
              <span className="text-[10px] text-slate-400">
                {description.length}/300
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what updates your followers will receive..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] transition-all resize-none"
            />
          </div>

          {/* Privacy Notice Box (WhatsApp Style) */}
          <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <Icon name="visibility" size="xs" className="text-[#2563EB] flex-shrink-0 mt-0.5" />
            <p className="text-[11.5px] leading-relaxed">
              Channels are public. Anyone on Veyra can find your channel and view updates. Your phone number and profile remain private from followers.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleSafeClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !name.trim()}
              className="!px-6 !py-2.5 !rounded-full !bg-[#2563EB] hover:!bg-blue-700 !text-white text-xs font-bold shadow-md shadow-blue-500/25 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Channel</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
