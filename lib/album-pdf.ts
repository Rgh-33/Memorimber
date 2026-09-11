import type { AlbumOrientation } from "@/lib/album-appearance";

const MILLIMETERS_PER_INCH = 25.4;
const PDF_POINTS_PER_INCH = 72;
const EXPORT_DPI = 300;

export const L_PHOTO_PAPER_MM = {
  portrait: { width: 89, height: 127 },
  landscape: { width: 127, height: 89 },
} as const;

export function getAlbumPdfPageSize(orientation: AlbumOrientation) {
  const paper = L_PHOTO_PAPER_MM[orientation];
  return {
    width: paper.width * PDF_POINTS_PER_INCH / MILLIMETERS_PER_INCH,
    height: paper.height * PDF_POINTS_PER_INCH / MILLIMETERS_PER_INCH,
  };
}

export function getAlbumPdfFilename(date: string) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "memory";
  return `memorimber-${safeDate}-l-size.pdf`;
}

export function getAlbumPngFilename(date: string) {
  return getAlbumPdfFilename(date).replace(/\.pdf$/, ".png");
}

export function getMonthlyAlbumFilename(month: string, page?: number) {
  const safeMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "monthly";
  return page === undefined ? `memorimber-${safeMonth}-l-size.pdf`
    : `memorimber-${safeMonth}-${page === 0 ? "cover" : `page-${page + 1}`}.png`;
}

function isIOSWebKit() {
  const userAgent = navigator.userAgent;
  return /AppleWebKit/i.test(userAgent)
    && (/iPhone|iPad|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
}

async function waitAtMost(promise: Promise<unknown>, milliseconds = 7000) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    promise,
    new Promise<void>((resolve) => { timeout = setTimeout(resolve, milliseconds); }),
  ]);
  if (timeout) clearTimeout(timeout);
}

async function waitForAlbumAssets(element: HTMLElement) {
  if (document.fonts) await waitAtMost(document.fonts.ready);
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await waitAtMost(new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      }));
    }
    if (image.naturalWidth > 0) await image.decode().catch(() => undefined);
  }));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export type AlbumExportPage = { element: HTMLElement; imageCount: number };

async function verifyEmbeddedImages(element: HTMLElement, expectedCount: number) {
  const images = Array.from(element.querySelectorAll("img"));
  const validImages = () => images.length === expectedCount && expectedCount > 0
    && element.querySelectorAll("img").length === expectedCount
    && images.every((image) => element.contains(image) && /^data:image\//.test(image.src)
      && !image.srcset && (!image.currentSrc || /^data:image\//.test(image.currentSrc)));
  const message = "印刷用の写真を描画できませんでした。写真が欠けた状態では保存できません。もう一度お試しください。";
  if (!validImages()) throw new Error(message);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(images.map((image) => image.decode())),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), 15000); }),
    ]);
    if (!validImages() || images.some((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)) {
      throw new Error(message);
    }
  } catch { throw new Error(message); }
  finally { if (timeout) clearTimeout(timeout); }
}

export async function renderAlbumPng(element: HTMLElement, orientation: AlbumOrientation, imageCount?: number) {
  if (imageCount !== undefined) await verifyEmbeddedImages(element, imageCount);
  await waitForAlbumAssets(element);

  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) throw new Error("アルバム紙面の大きさを取得できませんでした。");

  const paper = L_PHOTO_PAPER_MM[orientation];
  const targetWidth = Math.round(paper.width / MILLIMETERS_PER_INCH * EXPORT_DPI);
  const targetHeight = Math.round(paper.height / MILLIMETERS_PER_INCH * EXPORT_DPI);
  const pixelRatio = Math.min(4, Math.max(targetWidth / bounds.width, targetHeight / bounds.height));
  const backgroundColor = getComputedStyle(element).backgroundColor || "#fbf8f0";
  const { getFontEmbedCSS, toPng } = await import("html-to-image");
  const fontEmbedCSS = await getFontEmbedCSS(element).catch(() => undefined);
  const options = {
    backgroundColor,
    fontEmbedCSS,
    height: bounds.height,
    pixelRatio,
    skipAutoScale: true,
    width: bounds.width,
    filter: (node: HTMLElement) => !node.classList?.contains("print-hide"),
  };

  // Monthly export must be self-contained at the foreignObject boundary.
  if (imageCount !== undefined) await verifyEmbeddedImages(element, imageCount);

  // WebKit on iOS can return a blank first foreignObject raster. Warming the
  // cache once and using the second render avoids putting that blank page into
  // the PDF while keeping the exact same DOM and computed styles.
  if (isIOSWebKit()) await toPng(element, options);
  return toPng(element, options);
}

export async function createAlbumPng(element: HTMLElement, orientation: AlbumOrientation, imageCount?: number) {
  const dataUrl = await renderAlbumPng(element, orientation, imageCount);
  return (await fetch(dataUrl)).blob();
}

export async function createAlbumPdf(element: HTMLElement, orientation: AlbumOrientation) {
  return createAlbumPagesPdf([element], orientation);
}

export async function createAlbumPagesPdf(elements: Iterable<HTMLElement> | AsyncIterable<AlbumExportPage>, orientation: AlbumOrientation) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Memorinber memory page");
  pdf.setCreator("Memorinber");
  const pageSize = getAlbumPdfPageSize(orientation);
  // Render sequentially to avoid holding every page's canvas in memory on iOS.
  for await (const source of elements) {
    const { element, imageCount } = "element" in source ? source : { element: source, imageCount: undefined };
    const pngDataUrl = await renderAlbumPng(element, orientation, imageCount);
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    const image = await pdf.embedPng(pngDataUrl);
    page.drawImage(image, { x: 0, y: 0, width: pageSize.width, height: pageSize.height });
  }
  if (!pdf.getPageCount()) throw new Error("出力するアルバム紙面がありません。");
  const bytes = await pdf.save({ useObjectStreams: false });
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
