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
};

/**
 * PDFを全ページラスタライズして再構成し、編集可能な新規PDFとして返す。
 * 注意: 文字情報は画像化されるため保持されない。
 */
export async function flattenAndUnlockPdf(
  pdfBytes: Uint8Array,
  options: FlattenOptions = {}
): Promise<Uint8Array> {
  const scale = Math.max(2.0, options.scale ?? 2.0);
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    password: options.password
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
      const viewport = srcPage.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new PdfProcessingError("このPDFは処理できません。");

      await srcPage.render({ canvasContext: ctx, viewport }).promise;
      const pngDataUrl = canvas.toDataURL("image/png");
      const pngImage = await outDoc.embedPng(pngDataUrl);

      const pageWidth = viewport.width;
      const pageHeight = viewport.height;
      const outPage = outDoc.addPage([pageWidth, pageHeight]);
      outPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight
      });

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
