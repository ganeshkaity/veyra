export interface GiphyItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width?: string;
  height?: string;
}

export async function searchGifs(query: string = "", limit: number = 20): Promise<GiphyItem[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    const res = await fetch(`/api/gif/search?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to search GIFs");
    }

    return data.gifs || [];
  } catch (error) {
    console.error("GIPHY service search error:", error);
    throw error;
  }
}
