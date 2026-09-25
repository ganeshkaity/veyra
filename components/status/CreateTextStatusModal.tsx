"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { createStatus } from "@/lib/firestore/statusService";

interface CreateTextStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onStatusCreated?: (statusId: string) => void;
}

const PALETTES = [
  { id: "blue", color: "#2563EB", name: "Veyra Blue" },
  { id: "teal", color: "#14B8A6", name: "Veyra Teal" },
  { id: "navy", color: "#0F172A", name: "Deep Navy" },
  { id: "purple", color: "#7C3AED", name: "Royal Purple" },
  { id: "crimson", color: "#BE185D", name: "Crimson Rose" },
  { id: "emerald", color: "#059669", name: "Forest Emerald" },
];

export const CreateTextStatusModal: React.FC<CreateTextStatusModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onStatusCreated,
}) => {
  const [text, setText] = useState("");
  const [selectedColor, setSelectedColor] = useState("#2563EB");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const statusId = await createStatus({
        userId: currentUser.uid,
        userDisplayName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatarUrl: currentUser.avatarUrl,
        type: "text",
        content: text.trim(),
        backgroundColor: selectedColor,
      });

      setText("");
      onStatusCreated?.(statusId);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create status";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Text Status"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Live Visual Canvas Preview */}
        <div
          className="w-full h-56 rounded-2xl p-6 flex flex-col justify-between items-center text-center transition-colors shadow-inner"
          style={{ backgroundColor: selectedColor }}
        >
          <div className="w-full flex justify-end">
            <span className="text-[11px] font-mono text-white/70">
              {text.length} / 250
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your status..."
            maxLength={250}
            rows={3}
            autoFocus
            className="w-full bg-transparent text-white placeholder:text-white/60 text-xl font-bold text-center border-none outline-none resize-none leading-relaxed drop-shadow-sm"
          />

          <div className="text-[11px] text-white/70 font-medium">
            Disappears after 24 hours
          </div>
        </div>

        {/* Color Palette Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Background Color
          </label>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedColor(p.color)}
                title={p.name}
                className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
                  selectedColor === p.color
                    ? "scale-115 ring-2 ring-offset-2 ring-[#2563EB] dark:ring-offset-[#0F172A]"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: p.color }}
              >
                {selectedColor === p.color && (
                  <Icon name="check" size="xs" className="text-white text-[12px]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Emojis */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
          {["✨", "🔥", "❤️", "🚀", "☕", "🎉", "🌟", "🌸", "💯"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setText((prev) => (prev.length < 248 ? prev + emoji : prev))}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center text-sm"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!text.trim() || isSubmitting}
            isLoading={isSubmitting}
          >
            Share Status
          </Button>
        </div>
      </form>
    </Modal>
  );
};
