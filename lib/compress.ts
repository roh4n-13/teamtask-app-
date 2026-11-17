// Client-side photo compression (locked policy: ~200 KB per photo before upload).
// Phase 1 stores the compressed image as a local data URL (blob). Phase 2
// uploads the same compressed blob to Supabase Storage instead.

export interface CompressedImage {
  dataUrl: string;
  /** Size in bytes after compression. */
  sizeBytes: number;
  width: number;
  height: number;
}

const TARGET_BYTES = 200 * 1024; // ~200 KB
const MAX_DIMENSION = 1280;

/** Compress an image File to a JPEG data URL of roughly 200 KB or less. */
export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    // Scale down large images first — the biggest size win.
    const scale0 = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let w = Math.max(1, Math.round(bitmap.width * scale0));
    let h = Math.max(1, Math.round(bitmap.height * scale0));

    let quality = 0.85;
    let dataUrl = "";
    let sizeBytes = Infinity;

    // Step quality down; from attempt 3 also shrink dimensions, so even a
    // very noisy photo lands near the 200 KB target.
    for (let attempt = 0; attempt < 6 && sizeBytes > TARGET_BYTES; attempt++) {
      if (attempt >= 3) {
        w = Math.max(1, Math.round(w * 0.8));
        h = Math.max(1, Math.round(h * 0.8));
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.drawImage(bitmap, 0, 0, w, h);
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      // data URL is base64: ~4/3 of the byte size.
      sizeBytes = Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 0.75);
      quality = Math.max(0.35, quality - 0.12);
    }

    return { dataUrl, sizeBytes, width: w, height: h };
  } finally {
    bitmap.close();
  }
}

/** Human-readable size, e.g. "182 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
