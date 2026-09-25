"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import {
  getStickerPacks,
  searchStickers,
  StickerPack,
  StickerItem,
} from "@/lib/stickers/stickerService";

interface StickerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (stickerEmojiOrContent: string) => void;
}

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSticker,
}) => {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activePackId, setActivePackId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    getStickerPacks()
      .then((loadedPacks) => {
        setPacks(loadedPacks);
        if (loadedPacks.length > 0 && !activePackId) {
          setActivePackId(loadedPacks[0].id);
        }
      })
      .catch((err) => console.error("Failed to load sticker packs:", err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await searchStickers(val);
    setSearchResults(results);
  };

  const currentPack = packs.find((p) => p.id === activePackId) || packs[0];
  const isSearching = searchQuery.trim().length > 0;
  const displayedStickers = isSearching ? searchResults : currentPack?.stickers || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stickers" maxWidth="sm">
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Search stickers by name..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            leftIcon={<Icon name="search" size="sm" />}
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <Icon name="close" size="xs" />
            </button>
          )}
        </div>

        {/* Pack Selector Tabs (when not searching) */}
        {!isSearching && packs.length > 0 && (
          <div className="flex gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
            {packs.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setActivePackId(pack.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  activePackId === pack.id
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{pack.icon}</span>
                <span>{pack.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sticker Grid */}
        <div className="min-h-[220px] max-h-[300px] overflow-y-auto p-1">
          {isLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : displayedStickers.length > 0 ? (
            <div className="grid grid-cols-4 gap-2.5 justify-items-center">
              {displayedStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => {
                    onSelectSticker(sticker.content);
                    onClose();
                  }}
                  className="w-16 h-16 rounded-2xl p-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:scale-110 active:scale-95 transition-all shadow-xs border border-slate-200/50 dark:border-slate-700/50 group"
                  title={sticker.name}
                >
                  {sticker.content.startsWith("http") ? (
                    <img
                      src={sticker.previewUrl || sticker.content}
                      alt={sticker.name || "Sticker"}
                      className="w-full h-full object-contain filter drop-shadow-sm group-hover:drop-shadow-md transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-3xl transform transition-transform group-hover:rotate-6">
                      {sticker.content}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No stickers found for &quot;{searchQuery}&quot;.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
