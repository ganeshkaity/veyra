"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { searchGifs, GiphyItem } from "@/lib/gif/giphyService";
import {
  searchGiphyStickers,
  GiphyStickerItem,
  STICKER_QUICK_TAGS,
} from "@/lib/stickers/stickerService";
import emojiData from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

export type ExpressionTab = "emoji" | "gif" | "sticker";

interface MediaExpressionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string) => void;
  onSelectSticker: (stickerEmojiOrContent: string) => void;
  initialTab?: ExpressionTab;
}

// WhatsApp style clean vector emoji smiley icon
const EmojiTabIcon: React.FC<{ className?: string }> = ({
  className = "w-5 h-5",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <path d="M8.5 14.5c.8 1.8 2.2 2.5 3.5 2.5s2.7-.7 3.5-2.5" />
  </svg>
);

// WhatsApp/Telegram style folded sticker icon
const StickerTabIcon: React.FC<{ className?: string }> = ({
  className = "w-5 h-5",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M18.5 3h-13C4.12 3 3 4.12 3 5.5v13C3 19.88 4.12 21 5.5 21h8l6.5-6.5V5.5C20 4.12 18.88 3 18.5 3zm-5 16.5V15h4.5l-4.5 4.5z" />
  </svg>
);

// GIF Quick Reaction Tags matching user's reference image
const GIF_QUICK_TAGS = [
  { label: "Hi", emoji: "👋", query: "hello" },
  { label: "Haha", emoji: "😂", query: "haha lol" },
  { label: "Love", emoji: "❤️", query: "love" },
  { label: "Sad", emoji: "😢", query: "sad" },
  { label: "Wow", emoji: "😮", query: "wow" },
  { label: "Fire", emoji: "🔥", query: "fire lit" },
  { label: "Party", emoji: "🎉", query: "party celebrate" },
  { label: "Yes", emoji: "👍", query: "yes thumbs up" },
  { label: "Oops", emoji: "🤦", query: "facepalm" },
  { label: "Dance", emoji: "💃", query: "dance happy" },
  { label: "Thanks", emoji: "🙏", query: "thank you" },
  { label: "Sleepy", emoji: "😴", query: "sleepy tired" },
];

export const MediaExpressionsModal: React.FC<MediaExpressionsModalProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  initialTab = "emoji",
}) => {
  const [activeTab, setActiveTab] = useState<ExpressionTab>(initialTab);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // GIF state
  const [gifs, setGifs] = useState<GiphyItem[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [activeGifTag, setActiveGifTag] = useState<string | null>(null);

  // Sticker state
  const [stickers, setStickers] = useState<GiphyStickerItem[]>([]);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);
  const [stickerError, setStickerError] = useState<string | null>(null);
  const [activeStickerTag, setActiveStickerTag] = useState<string | null>("Trending");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery("");
      setIsSearchActive(false);
    }
  }, [isOpen, initialTab]);

  // Load trending GIFs when GIF tab activated
  const loadGifs = async (query = "") => {
    try {
      setIsLoadingGifs(true);
      setGifError(null);
      const results = await searchGifs(query, 24);
      setGifs(results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load GIFs from GIPHY.";
      setGifError(msg);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "gif" && gifs.length === 0) {
      loadGifs("");
    }
  }, [isOpen, activeTab]);

  // Load stickers from GIPHY when Sticker tab activated
  const loadStickers = async (query = "") => {
    try {
      setIsLoadingStickers(true);
      setStickerError(null);
      const results = await searchGiphyStickers(query, 30);
      setStickers(results);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load stickers from GIPHY.";
      setStickerError(msg);
    } finally {
      setIsLoadingStickers(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "sticker" && stickers.length === 0) {
      loadStickers("");
    }
  }, [isOpen, activeTab]);

  // Handle Search Input Change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setActiveGifTag(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (activeTab === "gif") {
      searchDebounceRef.current = setTimeout(() => {
        loadGifs(val.trim());
      }, 400);
    } else if (activeTab === "sticker") {
      searchDebounceRef.current = setTimeout(() => {
        loadStickers(val.trim());
      }, 400);
    }
  };

  // Quick tag selection for GIFs
  const handleSelectGifTag = (tag: (typeof GIF_QUICK_TAGS)[0]) => {
    if (activeGifTag === tag.label) {
      setActiveGifTag(null);
      setSearchQuery("");
      loadGifs("");
    } else {
      setActiveGifTag(tag.label);
      setSearchQuery(tag.label);
      loadGifs(tag.query);
    }
  };

  // Quick tag selection for Stickers
  const handleSelectStickerTag = (tag: (typeof STICKER_QUICK_TAGS)[0]) => {
    if (activeStickerTag === tag.label) {
      setActiveStickerTag("Trending");
      setSearchQuery("");
      loadStickers("");
    } else {
      setActiveStickerTag(tag.label);
      setSearchQuery(tag.label);
      loadStickers(tag.query);
    }
  };

  // Handle Esc and Click Outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40 sm:hidden backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Expressions Sheet Container */}
      <div
        ref={containerRef}
        className="fixed sm:absolute z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-full sm:mb-2 sm:left-2 w-full sm:w-[420px] max-w-full sm:max-w-[calc(100vw-1.5rem)] h-[65vh] sm:h-[480px] max-h-[90vh] bg-[#0c111a] dark:bg-[#0c111a] text-slate-100 rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Top Native-Style Drag Handle */}
        <div className="pt-2 pb-1 flex justify-center items-center flex-shrink-0">
          <div className="w-10 h-1 bg-slate-600/60 rounded-full" />
        </div>

        {/* Top Header Row with Segments and Actions */}
        <div className="px-3 py-1 flex items-center justify-between gap-2 border-b border-slate-800/80 flex-shrink-0">
          {/* Left: Search Toggle Button (for GIF & Sticker tabs) */}
          <div className="w-8 flex items-center justify-start">
            {activeTab !== "emoji" ? (
              <button
                type="button"
                onClick={() => {
                  setIsSearchActive(!isSearchActive);
                  if (!isSearchActive) {
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  } else {
                    setSearchQuery("");
                    if (activeTab === "gif") loadGifs("");
                    if (activeTab === "sticker") {
                      setActiveStickerTag("Trending");
                      loadStickers("");
                    }
                  }
                }}
                className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                  isSearchActive || searchQuery
                    ? "bg-slate-700/80 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title="Search"
                aria-label="Search expressions"
              >
                <Icon name="search" size="xs" />
              </button>
            ) : (
              <span className="w-6" />
            )}
          </div>

          {/* Center Segmented Pill Switcher: [ 😊 Emoji | GIF | 🏷️ Sticker ] */}
          <div className="flex items-center p-1 rounded-full bg-slate-800/90 border border-slate-700/60 shadow-inner">
            {/* Emoji Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("emoji");
                setSearchQuery("");
                setActiveGifTag(null);
                setIsSearchActive(false);
              }}
              className={`w-14 h-8 rounded-full flex items-center justify-center transition-all ${
                activeTab === "emoji"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Emojis"
              aria-label="Emoji section"
            >
              <EmojiTabIcon className="w-5 h-5" />
            </button>

            {/* GIF Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("gif");
                setSearchQuery("");
                setActiveGifTag(null);
                if (gifs.length === 0) loadGifs("");
              }}
              className={`w-14 h-8 rounded-full flex items-center justify-center transition-all ${
                activeTab === "gif"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="GIFs"
              aria-label="GIF section"
            >
              <span className="text-[12px] font-black tracking-wider leading-none select-none">
                GIF
              </span>
            </button>

            {/* Sticker Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("sticker");
                setSearchQuery("");
                setActiveGifTag(null);
                if (stickers.length === 0) loadStickers("");
              }}
              className={`w-14 h-8 rounded-full flex items-center justify-center transition-all ${
                activeTab === "sticker"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Stickers"
              aria-label="Sticker section"
            >
              <StickerTabIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Right: Close Button */}
          <div className="w-8 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
              aria-label="Close modal"
            >
              <Icon name="close" size="xs" />
            </button>
          </div>
        </div>

        {/* Expandable Search Input Bar (for GIF & Sticker tabs) */}
        {isSearchActive && activeTab !== "emoji" && (
          <div className="p-2.5 pb-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-1 duration-150 flex-shrink-0">
            <div className="relative flex-1 flex items-center">
              <span className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
                <Icon name="search" size="xs" />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={
                  activeTab === "gif"
                    ? "Search GIPHY for memes, reactions..."
                    : "Search GIPHY stickers..."
                }
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#14B8A6] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    if (activeTab === "gif") loadGifs("");
                    if (activeTab === "sticker") {
                      setActiveStickerTag("Trending");
                      loadStickers("");
                    }
                  }}
                  className="absolute right-2.5 text-slate-400 hover:text-white p-0.5"
                >
                  <Icon name="close" size="xs" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category Filter Pills (for GIF & Sticker tabs) */}
        {activeTab !== "emoji" && (
          <div className="px-3 py-2 border-b border-slate-800/80 overflow-x-auto scrollbar-none flex items-center gap-1.5 flex-shrink-0">
            {/* GIF Quick Reaction Chips */}
            {activeTab === "gif" &&
              GIF_QUICK_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => handleSelectGifTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 active:scale-95 ${
                    activeGifTag === tag.label
                      ? "bg-white text-slate-900 font-bold shadow-sm"
                      : "bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60"
                  }`}
                >
                  <span>{tag.emoji}</span>
                  <span>{tag.label}</span>
                </button>
              ))}

            {/* Sticker Quick Category Pills */}
            {activeTab === "sticker" &&
              STICKER_QUICK_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => handleSelectStickerTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all flex-shrink-0 active:scale-95 ${
                    activeStickerTag === tag.label
                      ? "bg-white text-slate-900 font-bold shadow-sm"
                      : "bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60"
                  }`}
                >
                  <span>{tag.emoji}</span>
                  <span>{tag.label}</span>
                </button>
              ))}
          </div>
        )}

        {/* Content View Area */}
        <div
          className={`flex-1 overflow-hidden flex flex-col ${
            activeTab === "emoji"
              ? "p-0 bg-[#0c111a]"
              : "p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700"
          }`}
        >
          {/* TAB 1: EMOJI CONTENT (Powered by Emoji Mart) */}
          {activeTab === "emoji" && (
            <div className="w-full h-full flex-1 flex justify-center items-stretch overflow-hidden">
              <Picker
                data={emojiData}
                onEmojiSelect={(emoji: any) => onSelectEmoji(emoji.native)}
                theme="dark"
                previewPosition="none"
                skinTonePosition="search"
                navPosition="top"
                searchPosition="sticky"
                dynamicWidth={true}
                autoFocus={false}
                maxFrequentRows={1}
              />
            </div>
          )}

          {/* TAB 2: GIF CONTENT (GIPHY) */}
          {activeTab === "gif" && (
            <div className="space-y-3">
              {gifError && (
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-center justify-between text-xs text-red-300">
                  <span>{gifError}</span>
                  <button
                    type="button"
                    onClick={() => loadGifs(searchQuery)}
                    className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 rounded-lg font-semibold transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Responsive Multi-column GIF Grid matching WhatsApp mobile */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {isLoadingGifs &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-28 rounded-xl bg-slate-800/80 animate-pulse border border-slate-700/40"
                    />
                  ))}

                {!isLoadingGifs &&
                  gifs.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => {
                        onSelectGif(gif.url);
                        onClose();
                      }}
                      className="relative h-28 rounded-xl overflow-hidden bg-slate-800/90 group hover:opacity-95 focus:ring-2 focus:ring-[#2563EB] transition-all transform hover:scale-[1.02] active:scale-95"
                      title={gif.title || "GIF"}
                    >
                      <img
                        src={gif.previewUrl || gif.url}
                        alt={gif.title || "GIF"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}

                {!isLoadingGifs && !gifError && gifs.length === 0 && (
                  <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-slate-400">
                    <Icon name="search_off" size="lg" className="mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-slate-200">
                      No GIFs found
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try searching another phrase or tap one of the category pills above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STICKER CONTENT (GIPHY Stickers) */}
          {activeTab === "sticker" && (
            <div className="space-y-3">
              {stickerError && (
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-center justify-between text-xs text-red-300">
                  <span>{stickerError}</span>
                  <button
                    type="button"
                    onClick={() => loadStickers(searchQuery)}
                    className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 rounded-lg font-semibold transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 justify-items-center">
                {isLoadingStickers &&
                  Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-800/80 animate-pulse border border-slate-700/40"
                    />
                  ))}

                {!isLoadingStickers &&
                  stickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => {
                        onSelectSticker(sticker.url);
                        onClose();
                      }}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1.5 flex items-center justify-center bg-slate-800/40 hover:bg-slate-800/90 hover:scale-110 active:scale-95 transition-all shadow-xs border border-transparent hover:border-slate-700/60 group"
                      title={sticker.title || "Sticker"}
                    >
                      <img
                        src={sticker.previewUrl || sticker.url}
                        alt={sticker.title || "Sticker"}
                        className="w-full h-full object-contain filter drop-shadow-sm group-hover:drop-shadow-md transition-transform"
                        loading="lazy"
                      />
                    </button>
                  ))}

                {!isLoadingStickers && !stickerError && stickers.length === 0 && (
                  <div className="col-span-full py-14 flex flex-col items-center justify-center text-center text-slate-400">
                    <Icon name="search_off" size="lg" className="mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-slate-200">
                      No stickers found
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try searching another phrase or tap one of the category pills above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info strip */}
        <div className="px-3.5 py-1.5 bg-slate-900/90 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between flex-shrink-0">
          {activeTab === "gif" || activeTab === "sticker" ? (
            <span className="flex items-center gap-1 font-semibold text-slate-400">
              <span>Powered by</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-extrabold tracking-wider">
                GIPHY
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1 font-semibold text-slate-400">
              <span>Powered by</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 font-extrabold tracking-wider">
                Emoji Mart
              </span>
            </span>
          )}

          <span className="hidden sm:inline text-slate-500">Press Esc to close</span>
        </div>
      </div>
    </>
  );
};
