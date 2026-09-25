/**
 * GIPHY Stickers Service for Veyra
 * Fetches transparent animated and static stickers directly from GIPHY API
 */

export interface GiphyStickerItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width?: string;
  height?: string;
}

// Quick reaction tags for stickers matching WhatsApp / Telegram UX
export const STICKER_QUICK_TAGS = [
  { label: "Trending", emoji: "✨", query: "" },
  { label: "Love", emoji: "❤️", query: "love hearts" },
  { label: "Cute", emoji: "🥺", query: "cute kawaii" },
  { label: "Happy", emoji: "😄", query: "happy excited" },
  { label: "Sad", emoji: "😢", query: "sad crying" },
  { label: "Celebration", emoji: "🎉", query: "celebration party" },
  { label: "Thumbs Up", emoji: "👍", query: "yes thumbs up" },
  { label: "Laugh", emoji: "😂", query: "lol haha" },
  { label: "Dance", emoji: "💃", query: "dance vibe" },
  { label: "Fire", emoji: "🔥", query: "fire lit" },
  { label: "Good Morning", emoji: "☕", query: "good morning" },
  { label: "Good Night", emoji: "🌙", query: "good night sleep" },
];

/**
 * Search or fetch trending stickers from GIPHY API
 */
export async function searchGiphyStickers(
  query: string = "",
  limit: number = 30,
  offset: number = 0
): Promise<GiphyStickerItem[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const res = await fetch(`/api/stickers/search?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch stickers from GIPHY");
    }

    return data.stickers || [];
  } catch (error) {
    console.error("GIPHY sticker service error:", error);
    throw error;
  }
}

// Legacy compatibility types and helper for any components referencing previous API
export interface StickerItem {
  id: string;
  name: string;
  content: string;
  type: "emoji" | "svg" | "image";
  previewUrl?: string;
}

export interface StickerPack {
  id: string;
  title: string;
  icon: string;
  stickers: StickerItem[];
}

export async function getStickerPacks(): Promise<StickerPack[]> {
  try {
    const trending = await searchGiphyStickers("", 24);
    return [
      {
        id: "giphy_trending",
        title: "Trending",
        icon: "🔥",
        stickers: trending.map((s) => ({
          id: s.id,
          name: s.title,
          content: s.url,
          type: "image" as const,
          previewUrl: s.previewUrl,
        })),
      },
    ];
  } catch {
    return [];
  }
}

export async function searchStickers(query: string): Promise<StickerItem[]> {
  try {
    const items = await searchGiphyStickers(query, 24);
    return items.map((s) => ({
      id: s.id,
      name: s.title,
      content: s.url,
      type: "image" as const,
      previewUrl: s.previewUrl,
    }));
  } catch {
    return [];
  }
}
