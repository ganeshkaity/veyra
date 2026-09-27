"use client";

import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { createStatus } from "@/lib/firestore/statusService";

interface CreateTextStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onStatusCreated?: (statusId: string) => void;
  onSwitchToPhoto?: () => void;
  onSwitchToVideo?: () => void;
  onSwitchToVoice?: () => void;
}

const PALETTES = [
  { id: "magenta", color: "#9B1B62", name: "Magenta Rose" },
  { id: "blue", color: "#2563EB", name: "Veyra Blue" },
  { id: "teal", color: "#0D9488", name: "Deep Teal" },
  { id: "navy", color: "#0F172A", name: "Deep Navy" },
  { id: "purple", color: "#7C3AED", name: "Royal Purple" },
  { id: "violet", color: "#8B5CF6", name: "Soft Violet" },
  { id: "crimson", color: "#E11D48", name: "Crimson" },
  { id: "coral", color: "#F43F5E", name: "Bright Coral" },
  { id: "emerald", color: "#059669", name: "Forest Emerald" },
  { id: "green", color: "#10B981", name: "Fresh Mint" },
  { id: "amber", color: "#D97706", name: "Warm Amber" },
  { id: "orange", color: "#EA580C", name: "Vibrant Orange" },
  { id: "gold", color: "#854D0E", name: "Antique Gold" },
  { id: "fuchsia", color: "#C026D3", name: "Fuchsia" },
  { id: "indigo", color: "#4F46E5", name: "Electric Indigo" },
  { id: "sky", color: "#0284C7", name: "Sky Blue" },
];

const FONTS = [
  { id: "sans", name: "Sans", fontClass: "font-sans", family: "var(--font-jakarta), sans-serif" },
  { id: "serif", name: "Serif", fontClass: "font-serif", family: "Georgia, Cambria, serif" },
  { id: "mono", name: "Mono", fontClass: "font-mono", family: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { id: "cursive", name: "Cursive", fontClass: "italic font-serif", family: "'Caveat', 'Brush Script MT', cursive, sans-serif" },
  { id: "display", name: "Bold", fontClass: "font-black tracking-tight", family: "Impact, 'Arial Black', sans-serif" },
];

export const CreateTextStatusModal: React.FC<CreateTextStatusModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onStatusCreated,
  onSwitchToPhoto,
  onSwitchToVideo,
  onSwitchToVoice,
}) => {
  const [text, setText] = useState("");
  const [selectedColor, setSelectedColor] = useState("#9B1B62");
  const [fontIndex, setFontIndex] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pushedHistoryRef = useRef(false);

  // Sync browser history state for Back button interception
  useEffect(() => {
    if (!isOpen) {
      setShowColorPicker(false);
      pushedHistoryRef.current = false;
      return;
    }

    if (typeof window !== "undefined") {
      const stateObj = { ...(window.history.state || {}), statusModal: "text" };
      window.history.pushState(stateObj, "", window.location.href);
      pushedHistoryRef.current = true;
    }

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      pushedHistoryRef.current = false;
      onClose();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => {
      window.removeEventListener("popstate", handlePopState, true);
    };
  }, [isOpen, onClose]);

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentFont = FONTS[fontIndex % FONTS.length];

  const handleCycleFont = () => {
    setFontIndex((prev) => (prev + 1) % FONTS.length);
  };

  const handleClose = () => {
    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const statusId = await createStatus({
        userId: currentUser.uid,
        userDisplayName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatarUrl: currentUser.avatarUrl,
        type: "text",
        content: text.trim(),
        backgroundColor: selectedColor,
        fontFamily: currentFont.id,
      });

      setText("");
      onStatusCreated?.(statusId);
      handleClose();
    } catch (err: any) {
      showToast(err.message || "Failed to create status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between transition-colors duration-300 select-none overflow-hidden animate-in fade-in duration-200"
      style={{ backgroundColor: selectedColor }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/80 text-white text-xs font-medium shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] z-20">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/35 text-white flex items-center justify-center backdrop-blur-md active:scale-95 transition-all cursor-pointer"
          title="Close (Esc)"
          aria-label="Close"
        >
          <Icon name="close" size="md" />
        </button>

        {/* Right Action Icons: Font switcher & Color palette */}
        <div className="flex items-center gap-3 relative">
          {/* Font Toggle Aa button */}
          <button
            type="button"
            onClick={handleCycleFont}
            className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/35 text-white flex items-center justify-center font-bold text-base backdrop-blur-md active:scale-95 transition-all cursor-pointer"
            title={`Font: ${currentFont.name}`}
            aria-label="Change font"
          >
            Aa
          </button>

          {/* Color Palette button */}
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white backdrop-blur-md active:scale-95 transition-all cursor-pointer ${
              showColorPicker ? "bg-white/35 ring-2 ring-white/60" : "bg-black/25 hover:bg-black/35"
            }`}
            title="Choose background color"
            aria-label="Choose color"
          >
            <Icon name="palette" size="sm" />
          </button>

          {/* Color Selection Popup Tray (~16 colors) */}
          {showColorPicker && (
            <div className="absolute top-12 right-0 mt-2 p-3 bg-black/85 backdrop-blur-xl border border-white/15 rounded-3xl shadow-2xl grid grid-cols-4 gap-2.5 z-30 animate-in fade-in zoom-in-95">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedColor(p.color);
                    setShowColorPicker(false);
                  }}
                  className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center shadow-md ${
                    selectedColor === p.color
                      ? "scale-115 ring-2 ring-white"
                      : "hover:scale-110 active:scale-95"
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.name}
                >
                  {selectedColor === p.color && (
                    <Icon name="check" size="xs" className="text-white text-[12px]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle Text Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-xl mx-auto w-full relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a status"
          maxLength={300}
          rows={3}
          style={{ fontFamily: currentFont.family }}
          className="w-full bg-transparent text-white placeholder:text-white/45 text-2xl sm:text-3xl md:text-4xl font-medium text-center border-none outline-none resize-none leading-relaxed tracking-wide drop-shadow-md caret-emerald-400"
        />

        {text.length > 250 && (
          <span className="text-[11px] font-mono text-white/60 mt-2">
            {300 - text.length} characters left
          </span>
        )}
      </div>

      {/* Floating Send Button (Visible when text entered) */}
      {text.trim().length > 0 && (
        <div className="absolute bottom-20 right-6 z-30 animate-in fade-in zoom-in-90">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-14 h-14 rounded-full bg-[#10B981] hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Share status"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="send" size="md" className="translate-x-0.5" />
            )}
          </button>
        </div>
      )}

      {/* Bottom Bar: Mode Selector Tabs (Video, Photo, Text, Voice) */}
      <div className="w-full pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/40 backdrop-blur-md pt-3 px-4 z-20">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2">
          {/* Video */}
          <button
            type="button"
            onClick={() => {
              if (onSwitchToVideo) onSwitchToVideo();
              else showToast("Video status is coming in V2!");
            }}
            className="px-4 py-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/10 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            Video
          </button>

          {/* Photo */}
          <button
            type="button"
            onClick={() => {
              handleClose();
              setTimeout(() => {
                onSwitchToPhoto?.();
              }, 100);
            }}
            className="px-4 py-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/10 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            Photo
          </button>

          {/* Text (Active tab with pill background) */}
          <button
            type="button"
            className="px-5 py-1.5 rounded-full bg-white/20 text-white font-bold text-xs tracking-wide shadow-sm backdrop-blur-md cursor-default"
          >
            Text
          </button>

          {/* Voice */}
          <button
            type="button"
            onClick={() => {
              if (onSwitchToVoice) onSwitchToVoice();
              else showToast("Voice note status is coming in V2!");
            }}
            className="px-4 py-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/10 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            Voice
          </button>
        </div>
      </div>
    </div>
  );
};
