import { NextRequest, NextResponse } from "next/server";

// Rate limiting in-memory store: IP -> { count, resetAt }
const uploadRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_UPLOADS_PER_WINDOW = 20;
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    // 1. Secret check (server-only)
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Image hosting service is not configured (missing IMGBB_API_KEY)" },
        { status: 500 }
      );
    }

    // 2. Rate limiting check
    const clientIp = getClientIp(req);
    const now = Date.now();
    const rateRecord = uploadRateLimitMap.get(clientIp);

    if (rateRecord && now < rateRecord.resetAt) {
      if (rateRecord.count >= MAX_UPLOADS_PER_WINDOW) {
        const retryAfterSec = Math.ceil((rateRecord.resetAt - now) / 1000);
        return NextResponse.json(
          { error: `Too many upload requests. Please wait ${retryAfterSec} seconds.` },
          {
            status: 429,
            headers: { "Retry-After": retryAfterSec.toString() },
          }
        );
      }
      rateRecord.count += 1;
    } else {
      uploadRateLimitMap.set(clientIp, { count: 1, resetAt: now + WINDOW_MS });
    }

    // 3. Extract and validate multipart form data
    const formData = await req.formData();
    const imageFile = formData.get("image") as Blob | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    // File size validation
    if (imageFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image file exceeds the 15 MB size limit." },
        { status: 413 }
      );
    }

    // MIME type validation
    if (!ALLOWED_MIME_TYPES.has(imageFile.type)) {
      return NextResponse.json(
        { error: "Unsupported image format. Allowed formats: JPEG, PNG, WebP, GIF." },
        { status: 415 }
      );
    }

    const uploadFormData = new FormData();
    uploadFormData.append("image", imageFile);

    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: uploadFormData,
    });

    const data = await imgbbRes.json();

    if (!imgbbRes.ok || !data.success) {
      return NextResponse.json(
        { error: data?.error?.message || "Failed to upload image to storage service." },
        { status: imgbbRes.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.data.url,
      display_url: data.data.display_url,
      thumb: data.data.thumb?.url,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error uploading image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
