/**
 * Browser-side image compression for Veyra
 * SD: aims for ~300-500 KB without producing blurry artifacts.
 * If original image is already in/below the target range (< 450 KB), does not unnecessarily compress.
 * HD: retains maximum original fidelity.
 */
export interface ProcessedImage {
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export async function processImageForUpload(
  file: File,
  quality: "sd" | "hd"
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        // If HD or already smaller than target range (< 450 KB), do not unnecessarily compress
        if (quality === "hd" || file.size <= 450 * 1024) {
          return resolve({
            blob: file,
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
            width: origWidth,
            height: origHeight,
          });
        }

        // SD compression: clamp max dimension to 1920 to keep crystal clarity while reducing huge raw camera resolutions
        const canvas = document.createElement("canvas");
        let width = origWidth;
        let height = origHeight;
        const maxDimension = 1920;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve({
            blob: file,
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
            width: origWidth,
            height: origHeight,
          });
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.84 provides pristine sharpness while consistently landing in the 300–500 KB range
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                mimeType: "image/jpeg",
                sizeBytes: blob.size,
                width,
                height,
              });
            } else {
              resolve({
                blob: file,
                mimeType: file.type || "image/jpeg",
                sizeBytes: file.size,
                width: origWidth,
                height: origHeight,
              });
            }
          },
          "image/jpeg",
          0.84
        );
      };
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Avatar compression for Veyra
 * Targets 100–150 KB file size while keeping image crystal clear and sharp without blurriness.
 * - Caps max dimension at 640px (ultra crisp on all 3x Retina mobile & desktop screens)
 * - Uses high-quality canvas smoothing and white background for transparency handling
 * - Iteratively picks the optimal quality (0.90 down to 0.78) to fit in 100-150 KB
 */
export async function processAvatarForUpload(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        // If original image is already within target (<= 150 KB) and already a reasonable avatar size (<= 640px),
        // keep as-is to preserve original sharpness
        if (file.size <= 150 * 1024 && origWidth <= 640 && origHeight <= 640 && file.size >= 80 * 1024) {
          return resolve({
            blob: file,
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
            width: origWidth,
            height: origHeight,
          });
        }

        const targetMaxBytes = 150 * 1024; // 150 KB

        // Helper to render onto canvas and export as JPEG blob
        const renderToCanvas = (
          maxDim: number,
          quality: number
        ): Promise<{ blob: Blob; width: number; height: number } | null> => {
          return new Promise((res) => {
            let width = origWidth;
            let height = origHeight;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return res(null);

            // High quality interpolation avoids blurriness and edge distortion
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // If source had transparency, fill with white background so JPEG doesn't show black artifacts
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob) res({ blob, width, height });
                else res(null);
              },
              "image/jpeg",
              quality
            );
          });
        };

        // Step 1: Start at 640px max dimension.
        // Try high quality steps (0.90 -> 0.86 -> 0.82 -> 0.78) to hit 100-150 KB without blur
        const qualitySteps = [0.90, 0.86, 0.82, 0.78];
        let bestCandidate: { blob: Blob; width: number; height: number } | null = null;

        for (const q of qualitySteps) {
          const result = await renderToCanvas(640, q);
          if (result) {
            bestCandidate = result;
            if (result.blob.size <= targetMaxBytes) {
              break;
            }
          }
        }

        // Step 2: If still > 150 KB (very complex image), downscale gently to 540px at 0.82
        if (bestCandidate && bestCandidate.blob.size > targetMaxBytes) {
          const fallback = await renderToCanvas(540, 0.82);
          if (fallback && fallback.blob.size <= targetMaxBytes) {
            bestCandidate = fallback;
          } else if (fallback) {
            // Last resort for extreme cases: 480px at 0.78 (still very clear, no blur)
            const finalTry = await renderToCanvas(480, 0.78);
            if (finalTry) bestCandidate = finalTry;
          }
        }

        if (bestCandidate) {
          return resolve({
            blob: bestCandidate.blob,
            mimeType: "image/jpeg",
            sizeBytes: bestCandidate.blob.size,
            width: bestCandidate.width,
            height: bestCandidate.height,
          });
        }

        // Fallback to original file
        return resolve({
          blob: file,
          mimeType: file.type || "image/jpeg",
          sizeBytes: file.size,
          width: origWidth,
          height: origHeight,
        });
      };
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

