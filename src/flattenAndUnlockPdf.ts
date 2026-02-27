import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export class PasswordRequiredError extends Error {
  constructor(message = "パスワードが必要です。") {
    super(message);
    this.name = "PasswordRequiredError";
  }
}

export class PdfProcessingError extends Error {
  constructor(message = "このPDFは処理できません。") {
    super(message);
    this.name = "PdfProcessingError";
  }
}

type FlattenOptions = {
  password?: string;
  scale?: number;
  cMapUrl?: string;
  standardFontDataUrl?: string;
};

/**
 * PDFを全ページラスタライズして再構成し、編集可能な新規PDFとして返す。
 * 注意: 文字情報は画像化されるため保持されない。
 */
export async function flattenAndUnlockPdf(
  pdfBytes: Uint8Array,
  options: FlattenOptions = {}
): Promise<Uint8Array> {
  const scale = Math.max(2.0, options.scale ?? 2.5);
  const cMapUrl = ensureTrailingSlash(options.cMapUrl ?? "/cmaps/");
  const standardFontDataUrl = ensureTrailingSlash(options.standardFontDataUrl ?? "/standard_fonts/");
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    password: options.password,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    useSystemFonts: true,
    disableFontFace: false
  });

  let sourceDoc: pdfjsLib.PDFDocumentProxy;
  try {
    sourceDoc = await loadingTask.promise;
  } catch (error) {
    if (isPasswordError(error)) {
      throw new PasswordRequiredError();
    }
    throw new PdfProcessingError("このPDFは処理できません。");
  }

  const outDoc = await PDFDocument.create();

  try {
    for (let pageNumber = 1; pageNumber <= sourceDoc.numPages; pageNumber += 1) {
      const srcPage = await sourceDoc.getPage(pageNumber);
      const baseViewport = srcPage.getViewport({ scale: 1.0 });
      const viewport = srcPage.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new PdfProcessingError("このPDFは処理できません。");

      // TextLayer相当の前処理としてテキスト抽出を先に実行し、フォント解決を促進
      // （環境によっては文字欠落の抑制に寄与）
      try {
        await srcPage.getTextContent();
      } catch {
        // テキスト抽出に失敗しても、画像化レンダリングは継続する
      }

      // 背景を白で固定してからprint意図で描画（文字欠落を低減）
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const renderTask = srcPage.render({ canvasContext: ctx, viewport, intent: "print" });
      await renderTask.promise;

      const pngDataUrl = canvas.toDataURL("image/png");
      const pngImage = await outDoc.embedPng(pngDataUrl);

      // 出力ページは元ページサイズ（scale:1）に揃える
      const pageWidth = baseViewport.width;
      const pageHeight = baseViewport.height;
      const outPage = outDoc.addPage([pageWidth, pageHeight]);
      outPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight
      });

      // 明示解放（長尺PDFでのメモリ保持を抑える）
      canvas.width = 0;
      canvas.height = 0;

      // ページ単位で制御を返し、長時間ブロックを緩和する
      await yieldToMainThread();
    }
  } catch (error) {
    if (error instanceof PasswordRequiredError) throw error;
    throw new PdfProcessingError("このPDFは処理できません。");
  } finally {
    await sourceDoc.destroy();
  }

  return outDoc.save();
}

function isPasswordError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { name?: string; code?: number };
  return maybe.name === "PasswordException" || maybe.code === 1 || maybe.code === 2;
}

async function yieldToMainThread(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(() => resolve(), 0);
  });
}

function ensureTrailingSlash(input: string): string {
  return input.endsWith("/") ? input : `${input}/`;
}
