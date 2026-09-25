import { processImageForUpload, processAvatarForUpload } from "./compression";

export interface UploadedImageResult {
  url: string;
  display_url: string;
  thumb?: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
}

export async function uploadImage(
  file: File,
  quality: "sd" | "hd"
): Promise<UploadedImageResult> {
  const processed = await processImageForUpload(file, quality);

  const formData = new FormData();
  formData.append("image", processed.blob, file.name);

  const response = await fetch("/api/upload/image", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to upload image to imgBB");
  }

  return {
    url: result.url,
    display_url: result.display_url || result.url,
    thumb: result.thumb,
    width: processed.width,
    height: processed.height,
    sizeBytes: processed.sizeBytes,
    mimeType: processed.mimeType,
    fileName: file.name,
  };
}

/**
 * Uploads an avatar/profile image to imgBB with high-clarity 100-150 KB compression.
 * Ensures the image is sharp, clear, and never saved as base64 in Firestore.
 */
export async function uploadAvatar(file: File): Promise<UploadedImageResult> {
  const processed = await processAvatarForUpload(file);

  const formData = new FormData();
  formData.append("image", processed.blob, file.name || "avatar.jpg");

  const response = await fetch("/api/upload/image", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to upload avatar to imgBB");
  }

  return {
    url: result.url,
    display_url: result.display_url || result.url,
    thumb: result.thumb,
    width: processed.width,
    height: processed.height,
    sizeBytes: processed.sizeBytes,
    mimeType: processed.mimeType,
    fileName: file.name,
  };
}

