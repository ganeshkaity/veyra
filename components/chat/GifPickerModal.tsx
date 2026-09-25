"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { searchGifs, GiphyItem } from "@/lib/gif/giphyService";

interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
}

export const GifPickerModal: React.FC<GifPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectGif,
}) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGifs = async (searchQuery: string = "") => {
    try {
      setIsLoading(true);
      setError(null);
      const results = await searchGifs(searchQuery, 24);
      setGifs(results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load GIFs from GIPHY.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Load trending when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      fetchGifs("");
    }
  }, [isOpen]);

  // Debounced search on user typing
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchGifs(val.trim());
    }, 400);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchGifs(query.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a GIF" maxWidth="md">
      <div className="space-y-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Input
            placeholder="Search GIPHY for memes, reactions, clips..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            leftIcon={<Icon name="search" size="sm" />}
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                fetchGifs("");
              }}
              className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <Icon name="close" size="xs" />
            </button>
          )}
        </form>

        {/* Error State with Retry Button */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 rounded-xl flex items-center justify-between text-xs text-red-600 dark:text-red-400">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchGifs(query)}
              className="px-2.5 py-1 bg-red-100 dark:bg-red-900/60 hover:bg-red-200 rounded-lg font-semibold transition-colors ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results Grid / Loading / Empty */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-h-[240px] max-h-[360px] overflow-y-auto p-1 scroll-smooth">
          {/* Loading Skeletons */}
          {isLoading &&
            Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
              />
            ))}

          {/* Results */}
          {!isLoading &&
            gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => {
                  onSelectGif(gif.url);
                  onClose();
                }}
                className="relative h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800/80 group hover:opacity-95 focus:ring-2 focus:ring-[#2563EB] transition-all transform hover:scale-[1.02] active:scale-95"
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

          {/* Empty State */}
          {!isLoading && !error && gifs.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-slate-400">
              <Icon name="search_off" size="lg" className="mb-2 opacity-50" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No GIFs found for &quot;{query}&quot;
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Try searching for another reaction, emoji, or keyword.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-1 font-semibold text-slate-500">
            <span>Powered by</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 font-extrabold tracking-wider">
              GIPHY
            </span>
          </span>
          <span className="text-[10px]">
            {query.trim() ? `Search: "${query.trim()}"` : "Trending on GIPHY"}
          </span>
        </div>
      </div>
    </Modal>
  );
};
