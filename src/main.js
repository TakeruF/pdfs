import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const state = {
  fileName: "",
  fileBytes: null,
  pdfjsDoc: null,
  pages: [],
  busy: false,
  dragIndex: null
};

const elements = {
  fileInput: document.querySelector("#file-input"),
  pages: document.querySelector("#pages"),
  status: document.querySelector("#status"),
  selectAllBtn: document.querySelector("#select-all-btn"),
  clearSelectionBtn: document.querySelector("#clear-selection-btn"),
  deleteSelectedBtn: document.querySelector("#delete-selected-btn"),
  exportCurrentBtn: document.querySelector("#export-current-btn"),
  openCurrentViewerBtn: document.querySelector("#open-current-viewer-btn"),
  exportSelectedBtn: document.querySelector("#export-selected-btn"),
  splitEachBtn: document.querySelector("#split-each-btn"),
  splitRangesInput: document.querySelector("#split-ranges-input"),
  splitRangesBtn: document.querySelector("#split-ranges-btn"),
  spreadBtn: document.querySelector("#spread-btn"),
  openSpreadViewerBtn: document.querySelector("#open-spread-viewer-btn"),
  spreadSelectedBtn: document.querySelector("#spread-selected-btn"),
  openSpreadSelectedViewerBtn: document.querySelector("#open-spread-selected-viewer-btn"),
  bindingSelect: document.querySelector("#binding-select")
};

elements.fileInput.addEventListener("change", onFileSelected);
elements.selectAllBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  state.pages.forEach((p) => (p.selected = true));
  renderPages();
  setStatus("すべてのページを選択しました。");
});
elements.clearSelectionBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  state.pages.forEach((p) => (p.selected = false));
  renderPages();
  setStatus("選択を解除しました。");
});
elements.deleteSelectedBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  const before = state.pages.length;
  state.pages = state.pages.filter((p) => !p.selected);
  if (!state.pages.length) {
    setStatus("すべて削除されたため操作を取り消しました。");
    state.pages = Array.from({ length: before }, (_, i) => ({
      srcIndex: i,
      selected: false
    }));
  }
  renderPages();
  setStatus("選択ページを削除しました。");
});
elements.exportCurrentBtn.addEventListener("click", () =>
  runBusyTask("PDFを書き出しています...", async () => {
    if (!requireLoaded()) return;
    const indices = state.pages.map((p) => p.srcIndex);
    await exportPdf(indices, `${baseName(state.fileName)}_ordered.pdf`);
  })
);
elements.openCurrentViewerBtn.addEventListener("click", () =>
  runBusyTask("Viewerで開くPDFを作成しています...", async () => {
    if (!requireLoaded()) return;
    const indices = state.pages.map((p) => p.srcIndex);
    const bytes = await createPdfFromIndices(indices);
    openInBrowserViewer(new Blob([bytes], { type: "application/pdf" }));
    setStatus("ブラウザのPDF Viewerで開きました。");
  })
);
elements.exportSelectedBtn.addEventListener("click", () =>
  runBusyTask("選択ページを書き出しています...", async () => {
    if (!requireLoaded()) return;
    const indices = state.pages.filter((p) => p.selected).map((p) => p.srcIndex);
    if (!indices.length) {
      setStatus("選択ページがありません。");
      return;
    }
    await exportPdf(indices, `${baseName(state.fileName)}_selected.pdf`);
  })
);
elements.splitEachBtn.addEventListener("click", () =>
  runBusyTask("ページ分割ZIPを作成しています...", async () => {
    if (!requireLoaded()) return;
    const zip = new JSZip();
    for (let i = 0; i < state.pages.length; i += 1) {
      const pageNumber = i + 1;
      const page = state.pages[i];
      const bytes = await createPdfFromIndices([page.srcIndex]);
      zip.file(`${baseName(state.fileName)}_page_${String(pageNumber).padStart(3, "0")}.pdf`, bytes);
    }
    await exportZip(zip, `${baseName(state.fileName)}_split_each.zip`);
  })
);
elements.splitRangesBtn.addEventListener("click", () =>
  runBusyTask("範囲分割ZIPを作成しています...", async () => {
    if (!requireLoaded()) return;
    const ranges = parseRanges(elements.splitRangesInput.value.trim(), state.pages.length);
    if (!ranges.length) {
      setStatus("範囲の指定が不正です。例: 1-3,4-6,7");
      return;
    }

    const zip = new JSZip();
    for (const [idx, range] of ranges.entries()) {
      const indices = range.map((pos) => state.pages[pos - 1].srcIndex);
      const bytes = await createPdfFromIndices(indices);
      zip.file(`${baseName(state.fileName)}_range_${String(idx + 1).padStart(2, "0")}.pdf`, bytes);
    }
    await exportZip(zip, `${baseName(state.fileName)}_split_ranges.zip`);
  })
);
elements.spreadBtn.addEventListener("click", () =>
  runBusyTask("見開きPDFを書き出しています...", async () => {
    if (!requireLoaded()) return;
    const bytes = await createSpreadPdf(state.pages.map((p) => p.srcIndex), currentBinding());
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName(state.fileName)}_spread.pdf`);
    setStatus("見開きPDFを書き出しました。");
  })
);
elements.openSpreadViewerBtn.addEventListener("click", () =>
  runBusyTask("見開きPDFを生成しています...", async () => {
    if (!requireLoaded()) return;
    const bytes = await createSpreadPdf(state.pages.map((p) => p.srcIndex), currentBinding());
    openInBrowserViewer(new Blob([bytes], { type: "application/pdf" }));
    setStatus("見開きPDFをブラウザのViewerで開きました。");
  })
);
elements.spreadSelectedBtn.addEventListener("click", () =>
  runBusyTask("選択ページの見開きPDFを書き出しています...", async () => {
    if (!requireLoaded()) return;
    const indices = selectedIndices();
    if (!indices.length) {
      setStatus("見開き変換するページを選択してください。");
      return;
    }
    const bytes = await createSpreadPdf(indices, currentBinding());
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName(state.fileName)}_spread_selected.pdf`);
    setStatus("選択ページの見開きPDFを書き出しました。");
  })
);
elements.openSpreadSelectedViewerBtn.addEventListener("click", () =>
  runBusyTask("選択ページの見開きPDFを生成しています...", async () => {
    if (!requireLoaded()) return;
    const indices = selectedIndices();
    if (!indices.length) {
      setStatus("見開き変換するページを選択してください。");
      return;
    }
    const bytes = await createSpreadPdf(indices, currentBinding());
    openInBrowserViewer(new Blob([bytes], { type: "application/pdf" }));
    setStatus("選択ページの見開きPDFをブラウザのViewerで開きました。");
  })
);

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  await runBusyTask("PDFを読み込んでいます...", async () => {
    const raw = await file.arrayBuffer();
    const normalized = normalizePdfBytes(new Uint8Array(raw));

    // pdf.js worker が data バッファを transfer する場合があるため、用途ごとに分離する
    const pdfjsBytes = new Uint8Array(normalized);
    const appBytes = new Uint8Array(normalized);

    const loadingTask = pdfjsLib.getDocument({ data: pdfjsBytes });
    const pdfjsDoc = await loadingTask.promise;

    state.fileName = file.name;
    state.fileBytes = appBytes;
    state.pdfjsDoc = pdfjsDoc;
    state.pages = Array.from({ length: pdfjsDoc.numPages }, (_, i) => ({
      srcIndex: i,
      selected: false
    }));

    await renderPages();
    setStatus(`読み込み完了: ${file.name} (${pdfjsDoc.numPages}ページ)`);
  });
}

function normalizePdfBytes(bytes) {
  const offset = findPdfHeaderOffset(bytes);
  if (offset < 0) {
    throw new Error("PDFヘッダー(%PDF-)を検出できませんでした。PDFファイルか確認してください。");
  }
  return offset === 0 ? bytes : bytes.slice(offset);
}

function findPdfHeaderOffset(bytes) {
  const max = Math.min(bytes.length - 4, 4096);
  for (let i = 0; i <= max; i += 1) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 &&
      bytes[i + 3] === 0x46 &&
      bytes[i + 4] === 0x2d
    ) {
      return i;
    }
  }
  return -1;
}

async function renderPages() {
  elements.pages.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const [idx, pageState] of state.pages.entries()) {
    const card = document.createElement("article");
    card.className = `page-card${pageState.selected ? " selected" : ""}`;
    card.draggable = true;
    card.dataset.position = String(idx);

    card.addEventListener("click", (event) => {
      if (event.target instanceof HTMLCanvasElement) {
        pageState.selected = !pageState.selected;
        card.classList.toggle("selected", pageState.selected);
      } else {
        pageState.selected = !pageState.selected;
        card.classList.toggle("selected", pageState.selected);
      }
    });

    card.addEventListener("dragstart", () => {
      state.dragIndex = idx;
      card.style.opacity = "0.45";
    });
    card.addEventListener("dragend", () => {
      state.dragIndex = null;
      card.style.opacity = "";
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      if (state.dragIndex === null || state.dragIndex === idx) return;
      const moved = state.pages.splice(state.dragIndex, 1)[0];
      state.pages.splice(idx, 0, moved);
      renderPages();
    });

    const indexEl = document.createElement("div");
    indexEl.className = "page-index";
    indexEl.textContent = `並び順: ${idx + 1}`;
    card.append(indexEl);

    const originalEl = document.createElement("div");
    originalEl.className = "page-original";
    originalEl.textContent = `元ページ: ${pageState.srcIndex + 1}`;
    card.append(originalEl);

    const canvas = document.createElement("canvas");
    canvas.width = 150;
    canvas.height = 200;
    card.append(canvas);

    fragment.append(card);

    renderThumbnail(canvas, pageState.srcIndex).catch(() => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fef0ef";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#8f1f16";
      ctx.font = "12px sans-serif";
      ctx.fillText("プレビュー失敗", 20, 24);
    });
  }

  elements.pages.append(fragment);
}

async function renderThumbnail(canvas, srcPageIndex) {
  if (!state.pdfjsDoc) return;
  const page = await state.pdfjsDoc.getPage(srcPageIndex + 1);
  const vp = page.getViewport({ scale: 1 });
  const scale = 150 / vp.width;
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
}

async function exportPdf(indices, fileName) {
  const bytes = await createPdfFromIndices(indices);
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), fileName);
  setStatus(`書き出し完了: ${fileName}`);
}

async function createPdfFromIndices(indices) {
  if (!state.fileBytes) throw new Error("PDF未読み込み");
  const src = await PDFDocument.load(state.fileBytes);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

async function createSpreadPdf(indices, binding = "left") {
  if (!state.fileBytes) throw new Error("PDF未読み込み");
  const src = await PDFDocument.load(state.fileBytes);
  const out = await PDFDocument.create();
  const isRightBinding = binding === "right";

  for (let i = 0; i < indices.length; i += 2) {
    const firstSrc = src.getPage(indices[i]);
    const secondSrc = indices[i + 1] !== undefined ? src.getPage(indices[i + 1]) : null;
    const leftSrc = isRightBinding ? secondSrc : firstSrc;
    const rightSrc = isRightBinding ? firstSrc : secondSrc;
    if (!leftSrc && !rightSrc) continue;

    const leftSize = leftSrc ? leftSrc.getSize() : null;
    const rightSize = rightSrc ? rightSrc.getSize() : null;
    const targetHeight = Math.max(leftSize?.height ?? 0, rightSize?.height ?? 0);

    let leftScale = 1;
    let leftWidth = 0;
    if (leftSize) {
      leftScale = targetHeight / leftSize.height;
      leftWidth = leftSize.width * leftScale;
    }

    let rightScale = 1;
    let rightWidth = 0;
    if (rightSize) {
      rightScale = targetHeight / rightSize.height;
      rightWidth = rightSize.width * rightScale;
    }

    const outPage = out.addPage([leftWidth + rightWidth, targetHeight]);
    if (leftSrc) {
      const leftEmbedded = await out.embedPage(leftSrc);
      outPage.drawPage(leftEmbedded, {
        x: 0,
        y: 0,
        width: leftWidth,
        height: targetHeight
      });
    }

    if (rightSrc) {
      const rightEmbedded = await out.embedPage(rightSrc);
      outPage.drawPage(rightEmbedded, {
        x: leftWidth,
        y: 0,
        width: rightWidth,
        height: targetHeight
      });
    }
  }

  return out.save();
}

async function exportZip(zip, fileName) {
  const content = await zip.generateAsync({ type: "blob" });
  downloadBlob(content, fileName);
  setStatus(`書き出し完了: ${fileName}`);
}

function parseRanges(input, maxPage) {
  if (!input) return [];
  const chunks = input.split(",").map((s) => s.trim()).filter(Boolean);
  const ranges = [];

  for (const chunk of chunks) {
    const m = chunk.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return [];
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (start < 1 || end < 1 || start > maxPage || end > maxPage || start > end) {
      return [];
    }

    const list = [];
    for (let i = start; i <= end; i += 1) list.push(i);
    ranges.push(list);
  }

  return ranges;
}

function baseName(fileName) {
  return fileName.replace(/\.pdf$/i, "") || "edited";
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function openInBrowserViewer(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function currentBinding() {
  return elements.bindingSelect.value === "right" ? "right" : "left";
}

function selectedIndices() {
  return state.pages.filter((p) => p.selected).map((p) => p.srcIndex);
}

function requireLoaded() {
  if (state.pages.length) return true;
  setStatus("先にPDFを読み込んでください。");
  return false;
}

async function runBusyTask(message, fn) {
  if (state.busy) return;
  state.busy = true;
  setStatus(message);
  toggleButtons(true);
  try {
    await fn();
  } catch (error) {
    setStatus(`エラー: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    state.busy = false;
    toggleButtons(false);
  }
}

function toggleButtons(disabled) {
  for (const el of [
    elements.selectAllBtn,
    elements.clearSelectionBtn,
    elements.deleteSelectedBtn,
    elements.exportCurrentBtn,
    elements.openCurrentViewerBtn,
    elements.exportSelectedBtn,
    elements.splitEachBtn,
    elements.splitRangesBtn,
    elements.spreadBtn,
    elements.openSpreadViewerBtn,
    elements.spreadSelectedBtn,
    elements.openSpreadSelectedViewerBtn
  ]) {
    el.disabled = disabled;
  }
}

function setStatus(text) {
  elements.status.textContent = text;
}
