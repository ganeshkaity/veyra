"use client";

import React, { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { MessageStatusTick } from "@/components/chat/MessageStatusTick";
import { useTheme } from "@/components/providers/ThemeProvider";

interface WallpaperPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null; // null or "default" or blob/https URL
  isCustom: boolean;
  onApply: () => Promise<void>;
  onRevertToDefault?: () => Promise<void>;
  isApplying: boolean;
}

/**
 * WallpaperPreviewModal
 *
 * Shows a realistic, interactive live preview of the selected wallpaper in a mock
 * Veyra conversation layout. Does NOT write any mock data into Firebase.
 */
export const WallpaperPreviewModal: React.FC<WallpaperPreviewModalProps> = ({
  isOpen,
  onClose,
  previewUrl,
  isCustom,
  onApply,
  onRevertToDefault,
  isApplying,
}) => {
  const { theme } = useTheme();
  // Allow toggling light/dark preview inside the modal to test readability in both modes
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(theme || "light");

  if (!isOpen) return null;

  const isPreviewCustom = Boolean(
    isCustom && previewUrl && previewUrl !== "default"
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#0F172A] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Wallpaper Preview
            </h3>
            <p className="text-[11px] text-slate-400">
              {isPreviewCustom ? "Custom Wallpaper" : "Default Veyra Wallpaper"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Button for Preview */}
            <button
              type="button"
              onClick={() =>
                setPreviewTheme((t) => (t === "dark" ? "light" : "dark"))
              }
              title={`Switch preview to ${
                previewTheme === "dark" ? "Light" : "Dark"
              } mode`}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Icon
                name={previewTheme === "dark" ? "light_mode" : "dark_mode"}
                size="xs"
              />
              <span className="capitalize">{previewTheme}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Icon name="close" size="xs" />
            </button>
          </div>
        </div>

        {/* Live Realistic Veyra Chat Mock Frame */}
        <div
          className={`flex-1 flex flex-col overflow-hidden ${
            previewTheme === "dark" ? "dark" : ""
          }`}
        >
          {/* Mock Conversation Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 z-10">
            <div className="flex items-center gap-2.5">
              <Avatar name="Aarav Sharma" size="sm" isOnline={true} />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Aarav Sharma
                </h4>
                <p className="text-[10px] text-emerald-500 font-medium leading-tight">
                  online
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <span className="p-1 rounded-lg">
                <Icon name="call" size="xs" />
              </span>
              <span className="p-1 rounded-lg">
                <Icon name="videocam" size="xs" />
              </span>
            </div>
          </div>

          {/* Layered Wallpaper Container */}
          <div className="relative flex-1 p-3.5 overflow-y-auto space-y-2.5 min-h-[300px]">
            {/* Layer 1: Base Background Color */}
            <div
              className={`absolute inset-0 pointer-events-none transition-colors duration-200 ${
                previewTheme === "dark" ? "bg-[#0B1120]" : "bg-[#EAE6DF]"
              }`}
            />

            {/* Layer 2: Image Layer (Default Doodle vs Custom Image) */}
            {isPreviewCustom ? (
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-200"
                style={{ backgroundImage: `url("${previewUrl}")` }}
              />
            ) : (
              <div
                className={`absolute inset-0 pointer-events-none transition-all duration-200 ${
                  previewTheme === "dark"
                    ? "universal-chat-doodle-layer opacity-[0.085] [filter:invert(1)]"
                    : "universal-chat-doodle-layer opacity-[0.35]"
                }`}
                style={{
                  backgroundImage: "url('/assets/chatbg.png')",
                  backgroundRepeat: "repeat",
                  backgroundSize: "360px",
                  backgroundPosition: "center top",
                }}
              />
            )}

            {/* Layer 3: Subtle Translucent Readability Veil */}
            {isPreviewCustom ? (
              <div
                className={`absolute inset-0 pointer-events-none transition-colors duration-200 ${
                  previewTheme === "dark" ? "bg-slate-950/45" : "bg-white/20"
                }`}
              />
            ) : (
              <div
                className={`absolute inset-0 pointer-events-none transition-colors duration-200 ${
                  previewTheme === "dark" ? "bg-black/15" : "bg-white/5"
                }`}
              />
            )}

            {/* Layer 4: Realistic Static Messages (Never written to Firebase) */}
            <div className="relative z-10 space-y-2.5">
              {/* Date Separator */}
              <div className="flex justify-center my-1">
                <span className="px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-[10px] font-bold text-slate-500 dark:text-slate-300 shadow-xs border border-slate-200/50 dark:border-slate-700/50 uppercase tracking-wider">
                  Today
                </span>
              </div>

              {/* Incoming Message Bubble */}
              <div className="flex items-end justify-start max-w-[80%]">
                <div
                  className={`p-2.5 px-3 rounded-2xl rounded-bl-sm shadow-xs ${
                    previewTheme === "dark"
                      ? "bg-[#1E293B] text-[#F8FAFC] border border-slate-800/80"
                      : "bg-white text-[#0F172A] border border-slate-100"
                  }`}
                >
                  <p className="text-xs leading-relaxed">
                    Hey! How does the new chat background look on your end? 🎨
                  </p>
                  <div className="flex items-center justify-end text-[9px] text-slate-400 mt-1">
                    <span>10:42 AM</span>
                  </div>
                </div>
              </div>

              {/* Outgoing Message Bubble */}
              <div className="flex items-end justify-end ml-auto max-w-[80%]">
                <div
                  className={`p-2.5 px-3 rounded-2xl rounded-br-sm shadow-xs ${
                    previewTheme === "dark"
                      ? "bg-[#0E4E5E] text-[#F8FAFC]"
                      : "bg-[#D9FDD3] text-[#0F172A]"
                  }`}
                >
                  <p className="text-xs leading-relaxed">
                    It looks incredible! Subtle, clean, and super comfortable to read. ✨
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 dark:text-slate-300 mt-1">
                    <span>10:43 AM</span>
                    <MessageStatusTick
                      status="read"
                      size={14}
                      className={
                        previewTheme === "dark" ? "text-[#14B8A6]" : "text-[#2563EB]"
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Incoming Message Bubble */}
              <div className="flex items-end justify-start max-w-[80%]">
                <div
                  className={`p-2.5 px-3 rounded-2xl rounded-bl-sm shadow-xs ${
                    previewTheme === "dark"
                      ? "bg-[#1E293B] text-[#F8FAFC] border border-slate-800/80"
                      : "bg-white text-[#0F172A] border border-slate-100"
                  }`}
                >
                  <p className="text-xs leading-relaxed">
                    Universal wallpaper active across all conversations! 🚀
                  </p>
                  <div className="flex items-center justify-end text-[9px] text-slate-400 mt-1">
                    <span>10:44 AM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mock Composer */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-800 z-10">
            <span className="p-1.5 rounded-lg text-slate-400">
              <Icon name="add" size="xs" />
            </span>
            <span className="p-1.5 rounded-lg text-slate-400">
              <Icon name="mood" size="xs" />
            </span>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-400">
              Type a message...
            </div>
            <span className="w-7 h-7 rounded-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white flex items-center justify-center shadow-xs">
              <Icon name="send" size="xs" />
            </span>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-3.5 px-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Applies universally to all one-on-one and group chats.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isApplying}
            >
              Cancel
            </Button>

            {isCustom && onRevertToDefault && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRevertToDefault}
                disabled={isApplying}
              >
                Use Default
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isApplying}
              onClick={onApply}
              leftIcon={<Icon name="check" size="xs" />}
            >
              {isPreviewCustom ? "Set as Wallpaper" : "Apply Default Wallpaper"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
