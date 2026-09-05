export const MEMORY_THUMBNAIL_MAX_EDGE = 720;
export const MEMORY_THUMBNAIL_TARGET_BYTES = 300 * 1024;

export type GeneratedMemoryThumbnail = {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  extension: "webp" | "jpg";
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch { /* Some browsers decode a format through <img> but not createImageBitmap. */ }
  }

  if (typeof Image === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("Image decoding is unavailable");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image decoding failed"));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeAtTargetSize(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg") {
  let smallest: Blob | null = null;
  for (const quality of [0.82, 0.72, 0.62]) {
    const blob = await encodeCanvas(canvas, type, quality);
    // Browsers without WebP support can silently return a PNG instead.
    if (!blob || blob.type !== type) return null;
    smallest = blob;
    if (blob.size <= MEMORY_THUMBNAIL_TARGET_BYTES) break;
  }
  return smallest;
}

/**
 * Build an optional, display-only derivative without ever modifying the
 * original File. A browser that cannot decode the source (notably some
 * HEIC/HEIF combinations) returns null so the original upload can continue.
 */
export async function createMemoryThumbnail(file: File): Promise<GeneratedMemoryThumbnail | null> {
  if (typeof document === "undefined") return null;

  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(file);
    if (decoded.width <= 0 || decoded.height <= 0) return null;

    const scale = Math.min(1, MEMORY_THUMBNAIL_MAX_EDGE / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.toBlob !== "function") return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    const webp = await encodeAtTargetSize(canvas, "image/webp");
    if (webp) return { blob: webp, contentType: "image/webp", extension: "webp" };

    const jpeg = await encodeAtTargetSize(canvas, "image/jpeg");
    return jpeg ? { blob: jpeg, contentType: "image/jpeg", extension: "jpg" } : null;
  } catch {
    return null;
  } finally {
    decoded?.close();
  }
}
