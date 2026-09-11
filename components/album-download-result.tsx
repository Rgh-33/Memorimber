"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AlbumDownload = { blob: Blob; url: string; filename: string };

export function useAlbumDownload() {
  const [result, setResult] = useState<AlbumDownload | null>(null);
  const urlRef = useRef<string | null>(null);
  const mounted = useRef(true);
  const clear = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setResult(null);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, []);
  const save = useCallback((blob: Blob, filename: string) => {
    if (!mounted.current) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setResult({ blob, url, filename });
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    document.body.appendChild(link);
    link.click(); link.remove();
  }, []);
  return { result, save, clear };
}

export function AlbumDownloadResult({ result }: { result: AlbumDownload | null }) {
  const [error, setError] = useState("");
  useEffect(() => { setError(""); }, [result]);
  if (!result) return null;
  const share = async () => {
    setError("");
    const file = new File([result.blob], result.filename, { type: result.blob.type });
    const data = { files: [file], title: "Memorimber アルバム" };
    if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) {
      window.open(result.url, "_blank", "noopener,noreferrer"); return;
    }
    try { await navigator.share(data); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError("共有できませんでした。「開く」または「ダウンロード」をお試しください。"); }
  };
  return <div className="print-hide mt-3 rounded-xl border border-coral/30 bg-ivory px-4 py-3 text-xs leading-5 text-ink/70">
    <p role="status">{result.blob.type === "image/png" ? "画像" : "PDF"}ができました。保存が始まらない場合はこちらから保存できます。</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <a href={result.url} download={result.filename} className="rounded-full bg-coral px-3 py-2 font-semibold text-white">ダウンロード</a>
      <button type="button" onClick={() => void share()} className="rounded-full border border-line px-3 py-2">共有・保存</button>
      <a href={result.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-2">開く</a>
    </div>
    {error && <p role="alert" className="mt-2">{error}</p>}
  </div>;
}
