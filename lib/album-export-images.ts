/** Export-only conversion: do not cache signed URLs or full-size image data. */
export async function loadAlbumExportImage(url: string, signal: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error("image response failed");
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith("image/")) throw new Error("invalid image blob");
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      const cancel = () => { reader.abort(); reject(new Error("image conversion cancelled")); };
      const cleanup = () => controller.signal.removeEventListener("abort", cancel);
      reader.onload = () => {
        cleanup();
        if (typeof reader.result !== "string" || !/^data:image\/[^;,]+;base64,.+/.test(reader.result)) {
          reject(new Error("invalid image data")); return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => { cleanup(); reject(new Error("image conversion failed")); };
      reader.onabort = () => { cleanup(); reject(new Error("image conversion cancelled")); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      if (controller.signal.aborted) { cleanup(); cancel(); return; }
      try { reader.readAsDataURL(blob); }
      catch (error) { cleanup(); reject(error); }
    });
  } catch {
    // Do not expose signed URLs/tokens in errors or silently export empty frames.
    throw new Error("印刷用の写真を画像データに変換できませんでした。通信状態を確認して、もう一度お試しください。");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
