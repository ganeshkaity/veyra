import { NextRequest, NextResponse } from "next/server";

// Rate limiting in-memory store: IP -> { count, resetAt }
const stickerRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_STICKER_REQUESTS_PER_MINUTE = 60;
const WINDOW_MS = 60 * 1000;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GIPHY service is not configured (missing GIPHY_API_KEY)" },
        { status: 500 }
      );
    }

    // Rate limiting check
    const clientIp = getClientIp(req);
    const now = Date.now();
    const rateRecord = stickerRateLimitMap.get(clientIp);

    if (rateRecord && now < rateRecord.resetAt) {
      if (rateRecord.count >= MAX_STICKER_REQUESTS_PER_MINUTE) {
        const retryAfterSec = Math.ceil((rateRecord.resetAt - now) / 1000);
        return NextResponse.json(
          { error: `Too many sticker search requests. Please wait ${retryAfterSec} seconds.` },
          {
            status: 429,
            headers: { "Retry-After": retryAfterSec.toString() },
          }
        );
      }
      rateRecord.count += 1;
    } else {
      stickerRateLimitMap.set(clientIp, { count: 1, resetAt: now + WINDOW_MS });
    }

    const { searchParams } = new URL(req.url);
    // Sanitize query parameters
    const rawQuery = (searchParams.get("q") || "").trim().slice(0, 100);
    const parsedLimit = parseInt(searchParams.get("limit") || "24", 10);
    const safeLimit = Math.min(Math.max(1, isNaN(parsedLimit) ? 24 : parsedLimit), 50);
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const safeOffset = Math.min(Math.max(0, isNaN(parsedOffset) ? 0 : parsedOffset), 500);

    const endpoint = rawQuery
      ? `https://api.giphy.com/v1/stickers/search?api_key=${apiKey}&q=${encodeURIComponent(
          rawQuery
        )}&limit=${safeLimit}&offset=${safeOffset}&rating=g`
      : `https://api.giphy.com/v1/stickers/trending?api_key=${apiKey}&limit=${safeLimit}&offset=${safeOffset}&rating=g`;

    const res = await fetch(endpoint);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || "Failed to fetch stickers from GIPHY" },
        { status: res.status }
      );
    }

    const results = (data.data || []).map((item: any) => ({
      id: item.id,
      title: item.title || "Sticker",
      url: item.images?.fixed_height?.url || item.images?.original?.url,
      previewUrl:
        item.images?.fixed_height_small?.url ||
        item.images?.fixed_height?.url ||
        item.images?.preview_gif?.url,
      width: item.images?.fixed_height?.width,
      height: item.images?.fixed_height?.height,
    }));

    return NextResponse.json({ success: true, stickers: results });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Server error fetching stickers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
