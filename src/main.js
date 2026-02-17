import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const A4_SIZE = { width: 595, height: 842 };

const state = {
  fileName: "",
  fileBytes: null,
  pdfjsDoc: null,
  pages: [],
  busy: false,
  dragIndex: null,
  defaultPageSize: { ...A4_SIZE }
};

const elements = {
  startScreen: document.querySelector("#start-screen"),
  workspace: document.querySelector("#workspace"),
  fileInput: document.querySelector("#file-input"),
  status: document.querySelector("#status"),
  workspaceStatus: document.querySelector("#workspace-status"),
  fileSummary: document.querySelector("#file-summary"),

  openSourceViewerBtn: document.querySelector("#open-source-viewer-btn"),
  showSelectionBtn: document.querySelector("#show-selection-btn"),
  showSpreadBtn: document.querySelector("#show-spread-btn"),

  selectionWorkbench: document.querySelector("#selection-workbench"),
  spreadWorkbench: document.querySelector("#spread-workbench"),

  selectAllBtn: document.querySelector("#select-all-btn"),
  clearSelectionBtn: document.querySelector("#clear-selection-btn"),
  deleteSelectedBtn: document.querySelector("#delete-selected-btn"),
  exportCurrentBtn: document.querySelector("#export-current-btn"),
  exportSelectedBtn: document.querySelector("#export-selected-btn"),
  rangeSplitInput: document.querySelector("#range-split-input"),
  rangeSplitExportBtn: document.querySelector("#range-split-export-btn"),

  insertAfterInput: document.querySelector("#insert-after-input"),
  insertBlankStartBtn: document.querySelector("#insert-blank-start-btn"),
  insertBlankBetweenBtn: document.querySelector("#insert-blank-between-btn"),
  insertBlankEndBtn: document.querySelector("#insert-blank-end-btn"),

  spreadBtn: document.querySelector("#spread-btn"),
  spreadSelectedBtn: document.querySelector("#spread-selected-btn"),
  bindingSelect: document.querySelector("#binding-select"),

  pages: document.querySelector("#pages")
};

elements.fileInput.addEventListener("change", onFileSelected);

elements.openSourceViewerBtn.addEventListener("click", () => {
  if (!state.fileBytes) {
    setStatus("先にPDFを読み込んでください。");
    return;
  }
  openInBrowserViewer(new Blob([state.fileBytes], { type: "application/pdf" }));
  setStatus("読み込みPDFをブラウザのViewerで開きました。", true);
});

elements.showSelectionBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  elements.selectionWorkbench.classList.remove("hidden");
  elements.spreadWorkbench.classList.add("hidden");
  setStatus("ページ選択モードを表示しました。", true);
});

elements.showSpreadBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  elements.spreadWorkbench.classList.remove("hidden");
  elements.selectionWorkbench.classList.add("hidden");
  setStatus("見開き書き出しモードを表示しました。", true);
});

elements.selectAllBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  state.pages.forEach((p) => (p.selected = true));
  renderPages();
  setStatus("すべてのページを選択しました。", true);
});

elements.clearSelectionBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  state.pages.forEach((p) => (p.selected = false));
  renderPages();
  setStatus("選択を解除しました。", true);
});

elements.deleteSelectedBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  const afterDelete = state.pages.filter((p) => !p.selected);
  if (!afterDelete.length) {
    setStatus("すべてのページを削除することはできません。", true);
    return;
  }
  state.pages = afterDelete;
  renderPages();
  setStatus("選択ページを削除しました。", true);
});

elements.insertBlankStartBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  insertBlankAt(0);
  setStatus("先頭に空白ページを追加しました。", true);
});

elements.insertBlankBetweenBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  const n = Number(elements.insertAfterInput.value);
  if (!Number.isInteger(n) || n < 1 || n >= state.pages.length) {
    setStatus(`nは1から${Math.max(state.pages.length - 1, 1)}の整数で指定してください。`, true);
    return;
  }
  insertBlankAt(n);
  setStatus(`${n}ページ目と${n + 1}ページ目の間に空白ページを追加しました。`, true);
});

elements.insertBlankEndBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  insertBlankAt(state.pages.length);
  setStatus("最後に空白ページを追加しました。", true);
});

elements.exportCurrentBtn.addEventListener("click", () =>
  runBusyTask("PDFを書き出しています...", async () => {
    if (!requireLoaded()) return;
    await exportPdf(state.pages, `${baseName(state.fileName)}_ordered.pdf`);
  })
);

elements.exportSelectedBtn.addEventListener("click", () =>
  runBusyTask("選択ページを書き出しています...", async () => {
    if (!requireLoaded()) return;
    const pages = selectedPages();
    if (!pages.length) {
      setStatus("選択ページがありません。", true);
      return;
    }
    await exportPdf(pages, `${baseName(state.fileName)}_selected.pdf`);
  })
);

elements.rangeSplitExportBtn.addEventListener("click", () =>
  runBusyTask("範囲分割ZIPを作成しています...", async () => {
    if (!requireLoaded()) return;
    const raw = elements.rangeSplitInput.value.trim();
    const groups = parseRangeGroups(raw, state.pages.length);
    if (!groups.length) {
      setStatus("範囲の入力形式が不正です。例: 1-3,4-6,7", true);
      return;
    }
    const zip = new JSZip();
    for (const [groupIndex, range] of groups.entries()) {
      const targetPages = range.map((pageNo) => state.pages[pageNo - 1]);
      const bytes = await createPdfFromEntries(targetPages);
      zip.file(`${baseName(state.fileName)}_range_${String(groupIndex + 1).padStart(2, "0")}.pdf`, bytes);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${baseName(state.fileName)}_ranges.zip`);
    setStatus("範囲分割ZIPを書き出しました。", true);
  })
);

elements.spreadBtn.addEventListener("click", () =>
  runBusyTask("見開きPDFを書き出しています...", async () => {
    if (!requireLoaded()) return;
    const bytes = await createSpreadPdf(state.pages, currentBinding());
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName(state.fileName)}_spread.pdf`);
    setStatus("見開きPDFを書き出しました。", true);
  })
);

elements.spreadSelectedBtn.addEventListener("click", () =>
  runBusyTask("選択ページの見開きPDFを書き出しています...", async () => {
    if (!requireLoaded()) return;
    const pages = selectedPages();
    if (!pages.length) {
      setStatus("見開き変換するページを選択してください。", true);
      return;
    }
    const bytes = await createSpreadPdf(pages, currentBinding());
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName(state.fileName)}_spread_selected.pdf`);
    setStatus("選択ページの見開きPDFを書き出しました。", true);
  })
);

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  await runBusyTask("PDFを読み込んでいます...", async () => {
    const raw = await file.arrayBuffer();
    const normalized = normalizePdfBytes(new Uint8Array(raw));

    const pdfjsBytes = new Uint8Array(normalized);
    const appBytes = new Uint8Array(normalized);

    const loadingTask = pdfjsLib.getDocument({ data: pdfjsBytes });
    const pdfjsDoc = await loadingTask.promise;
    const firstPage = await pdfjsDoc.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1 });

    state.fileName = file.name;
    state.fileBytes = appBytes;
    state.pdfjsDoc = pdfjsDoc;
    state.defaultPageSize = {
      width: Math.max(1, Math.round(firstViewport.width)),
      height: Math.max(1, Math.round(firstViewport.height))
    };
    state.pages = Array.from({ length: pdfjsDoc.numPages }, (_, i) => createSourcePageEntry(i));

    elements.startScreen.classList.add("hidden");
    elements.workspace.classList.remove("hidden");
    elements.selectionWorkbench.classList.add("hidden");
    elements.spreadWorkbench.classList.add("hidden");
    elements.fileSummary.textContent = `${file.name} (${pdfjsDoc.numPages}ページ)`;
    elements.insertAfterInput.value = "";
    elements.rangeSplitInput.value = "";

    await renderPages();
    setStatus(`読み込み完了: ${file.name}`, true);
  });
}

function createSourcePageEntry(srcIndex) {
  return {
    srcIndex,
    selected: false,
    isBlank: false,
    blankWidth: null,
    blankHeight: null
  };
}

function createBlankPageEntry() {
  return {
    srcIndex: null,
    selected: false,
    isBlank: true,
    blankWidth: state.defaultPageSize.width,
    blankHeight: state.defaultPageSize.height
  };
}

function insertBlankAt(position) {
  state.pages.splice(position, 0, createBlankPageEntry());
  renderPages();
}

async function renderPages() {
  elements.pages.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const [idx, pageState] of state.pages.entries()) {
    const card = document.createElement("article");
    card.className = `page-card${pageState.selected ? " selected" : ""}`;
    card.draggable = true;

    card.addEventListener("click", () => {
      pageState.selected = !pageState.selected;
      card.classList.toggle("selected", pageState.selected);
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
    originalEl.textContent = pageState.isBlank ? "空白ページ" : `元ページ: ${pageState.srcIndex + 1}`;
    card.append(originalEl);

    const canvas = document.createElement("canvas");
    canvas.width = 150;
    canvas.height = 200;
    card.append(canvas);

    fragment.append(card);

    if (pageState.isBlank) {
      renderBlankThumbnail(canvas);
    } else {
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
  }

  elements.pages.append(fragment);
}

function renderBlankThumbnail(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  canvas.width = 150;
  canvas.height = 212;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d0d7e2";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  ctx.fillStyle = "#687689";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("BLANK PAGE", 28, 104);
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

async function exportPdf(pageEntries, fileName) {
  const bytes = await createPdfFromEntries(pageEntries);
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), fileName);
  setStatus(`書き出し完了: ${fileName}`, true);
}

async function createPdfFromEntries(pageEntries) {
  if (!state.fileBytes) throw new Error("PDF未読み込み");
  const src = await PDFDocument.load(state.fileBytes);
  const out = await PDFDocument.create();

  for (const entry of pageEntries) {
    if (entry.isBlank) {
      out.addPage([entry.blankWidth || state.defaultPageSize.width, entry.blankHeight || state.defaultPageSize.height]);
      continue;
    }
    const [copied] = await out.copyPages(src, [entry.srcIndex]);
    out.addPage(copied);
  }

  return out.save();
}

async function createSpreadPdf(pageEntries, binding = "left") {
  if (!state.fileBytes) throw new Error("PDF未読み込み");
  const src = await PDFDocument.load(state.fileBytes);
  const out = await PDFDocument.create();
  const isRightBinding = binding === "right";

  for (let i = 0; i < pageEntries.length; i += 2) {
    const first = pageEntries[i];
    const second = pageEntries[i + 1] ?? null;
    const left = isRightBinding ? second : first;
    const right = isRightBinding ? first : second;

    const leftInfo = resolveSpreadInfo(left, src);
    const rightInfo = resolveSpreadInfo(right, src);
    const targetHeight = Math.max(
      leftInfo?.height ?? 0,
      rightInfo?.height ?? 0,
      state.defaultPageSize.height
    );

    const leftWidth = leftInfo ? (leftInfo.width * targetHeight) / leftInfo.height : 0;
    const rightWidth = rightInfo ? (rightInfo.width * targetHeight) / rightInfo.height : 0;

    const outPage = out.addPage([leftWidth + rightWidth, targetHeight]);

    if (leftInfo?.srcPage) {
      const leftEmbedded = await out.embedPage(leftInfo.srcPage);
      outPage.drawPage(leftEmbedded, {
        x: 0,
        y: 0,
        width: leftWidth,
        height: targetHeight
      });
    }

    if (rightInfo?.srcPage) {
      const rightEmbedded = await out.embedPage(rightInfo.srcPage);
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

function resolveSpreadInfo(entry, src) {
  if (!entry) return null;
  if (entry.isBlank) {
    return {
      width: entry.blankWidth || state.defaultPageSize.width,
      height: entry.blankHeight || state.defaultPageSize.height,
      srcPage: null
    };
  }
  const srcPage = src.getPage(entry.srcIndex);
  const size = srcPage.getSize();
  return {
    width: size.width,
    height: size.height,
    srcPage
  };
}

function normalizePdfBytes(bytes) {
  const offset = findPdfHeaderOffset(bytes);
  if (offset < 0) {
    throw new Error("PDFヘッダー(%PDF-)を検出できませんでした。PDFファイルか確認してください。");
  }
  return offset === 0 ? bytes : bytes.slice(offset);
}

function parseRangeGroups(input, maxPage) {
  if (!input) return [];
  const chunks = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!chunks.length) return [];

  const groups = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return [];
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
    if (start < 1 || end < 1 || start > end || end > maxPage) return [];
    const range = [];
    for (let i = start; i <= end; i += 1) {
      range.push(i);
    }
    groups.push(range);
  }
  return groups;
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

function selectedPages() {
  return state.pages.filter((p) => p.selected);
}

function requireLoaded() {
  if (state.pages.length) return true;
  setStatus("先にPDFを読み込んでください。");
  return false;
}

async function runBusyTask(message, fn) {
  if (state.busy) return;
  state.busy = true;
  setStatus(message, !elements.workspace.classList.contains("hidden"));
  toggleButtons(true);
  try {
    await fn();
  } catch (error) {
    setStatus(`エラー: ${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    state.busy = false;
    toggleButtons(false);
  }
}

function toggleButtons(disabled) {
  for (const el of [
    elements.openSourceViewerBtn,
    elements.showSelectionBtn,
    elements.showSpreadBtn,
    elements.selectAllBtn,
    elements.clearSelectionBtn,
    elements.deleteSelectedBtn,
    elements.exportCurrentBtn,
    elements.exportSelectedBtn,
    elements.rangeSplitExportBtn,
    elements.insertBlankStartBtn,
    elements.insertBlankBetweenBtn,
    elements.insertBlankEndBtn,
    elements.spreadBtn,
    elements.spreadSelectedBtn
  ]) {
    el.disabled = disabled;
  }
  elements.insertAfterInput.disabled = disabled;
  elements.rangeSplitInput.disabled = disabled;
}

function setStatus(text, inWorkspace = false) {
  if (inWorkspace || !elements.workspace.classList.contains("hidden")) {
    elements.workspaceStatus.textContent = text;
  } else {
    elements.status.textContent = text;
  }
}
