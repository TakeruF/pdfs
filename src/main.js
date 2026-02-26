import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { flattenAndUnlockPdf, PasswordRequiredError, PdfProcessingError } from "./flattenAndUnlockPdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const A4_SIZE = { width: 595, height: 842 };

const state = {
  language: "ja",
  fileName: "",
  fileBytes: null,
  pdfjsDoc: null,
  pages: [],
  busy: false,
  dragIndex: null,
  defaultPageSize: { ...A4_SIZE },
  editable: true,
  useIgnoreEncryption: false,
  editErrorDetail: "",
  editWarningCode: "",
  previewSupported: true,
  inSitePreviewEnabled: true
};

const elements = {
  startScreen: document.querySelector("#start-screen"),
  workspace: document.querySelector("#workspace"),
  fileInput: document.querySelector("#file-input"),
  langZhBtn: document.querySelector("#lang-zh-btn"),
  langJaBtn: document.querySelector("#lang-ja-btn"),
  inSitePreviewToggle: document.querySelector("#in-site-preview-toggle"),
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

const translations = {
  ja: {
    "label.language": "言語",
    "title.app": "pdf organizer",
    "desc.app": "ブラウザ内だけで PDF を編集します。ファイルはサーバーへ送信しません。",
    "btn.selectPdf": "PDFを選択",
    "label.previewInSite": "サイト内でPDFプレビューする",
    "note.previewHeavy": "100ページ以上のPDFで動作が不安定な場合は、この設定をオフにすることを推奨します。",
    "status.pleaseSelectPdf": "PDFを選択してください。",
    "btn.previewBrowser": "ブラウザでプレビュー",
    "btn.organizeAndExport": "ページを整理して書き出し",
    "btn.exportSpread": "見開きで書き出し",
    "hint.selectAndDrag": "ページをクリックで選択、ドラッグで並び替え",
    "title.selection": "選択操作と書き出し",
    "btn.selectAll": "全選択",
    "btn.clearSelection": "選択解除",
    "btn.deleteSelected": "選択ページを削除",
    "btn.exportCurrentOrder": "現在の並びで書き出し",
    "btn.exportSelectedOnly": "選択ページのみ書き出し",
    "title.rangeSplit": "範囲分割（ページ番号入力）",
    "hint.rangeSplitExample": "例: <code>1-3,4-6,7</code> で3つのPDFをZIP出力",
    "label.rangeInput": "分割範囲",
    "ph.rangeSplit": "1-3,4-6,7",
    "btn.exportRangeZip": "範囲分割ZIPを書き出し",
    "title.addBlank": "空白ページを追加",
    "label.insertBetween": "nとn+1の間 (n)",
    "ph.insertAfter": "例: 3",
    "btn.addBlankStart": "先頭に追加",
    "btn.addBlankBetween": "nとn+1の間に追加",
    "btn.addBlankEnd": "最後に追加",
    "label.binding": "見開きの綴じ方向",
    "opt.bindingLeft": "左綴じ（一般）",
    "opt.bindingRight": "右綴じ（国語・縦書き本）",
    "btn.exportSpreadAll": "見開き（全ページ）で書き出し",
    "btn.exportSpreadSelected": "見開き（選択ページ）で書き出し",
    "status.previewUnsupportedShort": "iOS（WebKit）ではプレビュー不可",
    "status.previewUnsupportedInit": "iOS（WebKit）ではblobプレビューが不安定なため、プレビュー機能を無効化しています。",
    "status.previewUnsupportedUse": "iOS（WebKit）ではプレビュー機能を利用できません。",
    "status.loadPdfFirst": "先にPDFを読み込んでください。",
    "status.openedInBrowserViewer": "読み込みPDFをブラウザのViewerで開きました。",
    "status.modeSelectionShown": "ページ選択モードを表示しました。",
    "status.modeSpreadShown": "見開き書き出しモードを表示しました。",
    "status.selectedAll": "すべてのページを選択しました。",
    "status.selectionCleared": "選択を解除しました。",
    "status.cannotDeleteAll": "すべてのページを削除することはできません。",
    "status.deletedSelected": "選択ページを削除しました。",
    "status.addedBlankStart": "先頭に空白ページを追加しました。",
    "status.invalidNRange": "nは1から{max}の整数で指定してください。",
    "status.addedBlankBetween": "{n}ページ目と{nPlusOne}ページ目の間に空白ページを追加しました。",
    "status.addedBlankEnd": "最後に空白ページを追加しました。",
    "status.exportingPdf": "PDFを書き出しています...",
    "status.exportingSelected": "選択ページを書き出しています...",
    "status.noSelectedPages": "選択ページがありません。",
    "status.exportingRangeZip": "範囲分割ZIPを作成しています...",
    "status.invalidRangeInput": "範囲の入力形式が不正です。例: 1-3,4-6,7",
    "status.exportedRangeZip": "範囲分割ZIPを書き出しました。",
    "status.exportingSpread": "見開きPDFを書き出しています...",
    "status.exportedSpread": "見開きPDFを書き出しました。",
    "status.exportingSpreadSelected": "選択ページの見開きPDFを書き出しています...",
    "status.selectForSpread": "見開き変換するページを選択してください。",
    "status.exportedSpreadSelected": "選択ページの見開きPDFを書き出しました。",
    "status.loadingPdf": "PDFを読み込んでいます...",
    "status.unlockingPdf": "保護されたPDFを変換しています...",
    "status.passwordPrompt": "PDFのパスワードを入力してください。",
    "status.passwordPromptRetry": "パスワードが違います。もう一度入力してください。",
    "status.passwordCancelled": "パスワード入力がキャンセルされました。",
    "status.passwordRequired": "このPDFはパスワードが必要です。",
    "status.unlockFailed": "保護PDFの変換に失敗しました。{detail}",
    "status.fileSummary": "{name} ({pages}ページ)",
    "status.loadDoneNotEditable": "読み込み完了（編集不可）: {detail}",
    "status.loadDoneHeavyAdvice": "読み込み完了: {name}。100ページ以上のため、不安定な場合は「サイト内でPDFプレビューする」をオフ推奨。",
    "status.loadDoneCompat": "読み込み完了（互換モード）: 暗号化PDFのため ignoreEncryption を使用します。",
    "status.loadDone": "読み込み完了: {name}",
    "status.encryptedPreviewOnly": "暗号化PDFは互換モードで読み込みました。白紙出力を防ぐため、編集/書き出しは無効です（プレビューのみ）。",
    "card.order": "並び順: {num}",
    "card.blank": "空白ページ",
    "card.original": "元ページ: {num}",
    "card.previewFailed": "プレビュー失敗",
    "card.previewOff": "プレビューOFF",
    "card.blankPage": "BLANK PAGE",
    "status.exportDone": "書き出し完了: {name}",
    "error.noPdfHeader": "PDFヘッダー(%PDF-)を検出できませんでした。PDFファイルか確認してください。",
    "status.editNotAllowed": "編集不可: {detail}",
    "status.error": "エラー: {detail}",
    "status.previewInSiteOn": "サイト内プレビューを有効にしました。",
    "status.previewInSiteOff": "サイト内プレビューを無効にしました（軽量モード）。",
    "error.notLoaded": "PDF未読み込み"
  },
  zh: {
    "label.language": "语言",
    "title.app": "pdf organizer",
    "desc.app": "仅在浏览器内编辑 PDF。文件不会上传到服务器。",
    "btn.selectPdf": "选择PDF",
    "label.previewInSite": "站内预览PDF",
    "note.previewHeavy": "当PDF超过100页且不稳定时，建议关闭此设置。",
    "status.pleaseSelectPdf": "请选择PDF。",
    "btn.previewBrowser": "在浏览器中预览",
    "btn.organizeAndExport": "整理页面并导出",
    "btn.exportSpread": "按跨页导出",
    "hint.selectAndDrag": "点击页面可选择，拖拽可排序",
    "title.selection": "选择与导出",
    "btn.selectAll": "全选",
    "btn.clearSelection": "取消选择",
    "btn.deleteSelected": "删除已选页面",
    "btn.exportCurrentOrder": "按当前顺序导出",
    "btn.exportSelectedOnly": "仅导出已选页面",
    "title.rangeSplit": "范围拆分（输入页码）",
    "hint.rangeSplitExample": "示例: <code>1-3,4-6,7</code> 将输出3个PDF并打包ZIP",
    "label.rangeInput": "拆分范围",
    "ph.rangeSplit": "1-3,4-6,7",
    "btn.exportRangeZip": "导出范围拆分ZIP",
    "title.addBlank": "添加空白页",
    "label.insertBetween": "插入到 n 与 n+1 之间 (n)",
    "ph.insertAfter": "例如: 3",
    "btn.addBlankStart": "添加到开头",
    "btn.addBlankBetween": "添加到 n 与 n+1 之间",
    "btn.addBlankEnd": "添加到末尾",
    "label.binding": "跨页装订方向",
    "opt.bindingLeft": "左装订（常规）",
    "opt.bindingRight": "右装订（竖排/教材）",
    "btn.exportSpreadAll": "导出跨页（全部）",
    "btn.exportSpreadSelected": "导出跨页（已选）",
    "status.previewUnsupportedShort": "iOS（WebKit）不支持预览",
    "status.previewUnsupportedInit": "iOS（WebKit）下 blob 预览不稳定，已禁用预览功能。",
    "status.previewUnsupportedUse": "iOS（WebKit）无法使用预览功能。",
    "status.loadPdfFirst": "请先加载PDF。",
    "status.openedInBrowserViewer": "已在浏览器查看器中打开PDF。",
    "status.modeSelectionShown": "已显示页面选择模式。",
    "status.modeSpreadShown": "已显示跨页导出模式。",
    "status.selectedAll": "已全选所有页面。",
    "status.selectionCleared": "已取消选择。",
    "status.cannotDeleteAll": "不能删除全部页面。",
    "status.deletedSelected": "已删除所选页面。",
    "status.addedBlankStart": "已在开头添加空白页。",
    "status.invalidNRange": "n 请输入 1 到 {max} 的整数。",
    "status.addedBlankBetween": "已在第 {n} 页与第 {nPlusOne} 页之间添加空白页。",
    "status.addedBlankEnd": "已在末尾添加空白页。",
    "status.exportingPdf": "正在导出PDF...",
    "status.exportingSelected": "正在导出所选页面...",
    "status.noSelectedPages": "未选择任何页面。",
    "status.exportingRangeZip": "正在生成范围拆分ZIP...",
    "status.invalidRangeInput": "范围格式不正确。示例: 1-3,4-6,7",
    "status.exportedRangeZip": "已导出范围拆分ZIP。",
    "status.exportingSpread": "正在导出跨页PDF...",
    "status.exportedSpread": "已导出跨页PDF。",
    "status.exportingSpreadSelected": "正在导出已选页面的跨页PDF...",
    "status.selectForSpread": "请选择要跨页转换的页面。",
    "status.exportedSpreadSelected": "已导出已选页面的跨页PDF。",
    "status.loadingPdf": "正在加载PDF...",
    "status.unlockingPdf": "正在转换受保护的PDF...",
    "status.passwordPrompt": "请输入PDF密码。",
    "status.passwordPromptRetry": "密码不正确，请重试。",
    "status.passwordCancelled": "已取消输入密码。",
    "status.passwordRequired": "此PDF需要密码。",
    "status.unlockFailed": "受保护PDF转换失败。{detail}",
    "status.fileSummary": "{name}（{pages}页）",
    "status.loadDoneNotEditable": "加载完成（不可编辑）: {detail}",
    "status.loadDoneHeavyAdvice": "加载完成: {name}。页数超过100时若不稳定，建议关闭“站内预览PDF”。",
    "status.loadDoneCompat": "加载完成（兼容模式）: 因PDF加密，已使用 ignoreEncryption。",
    "status.loadDone": "加载完成: {name}",
    "status.encryptedPreviewOnly": "已用兼容模式读取加密PDF。为避免导出空白，已禁用编辑/导出（仅可预览）。",
    "card.order": "顺序: {num}",
    "card.blank": "空白页",
    "card.original": "原始页: {num}",
    "card.previewFailed": "预览失败",
    "card.previewOff": "预览已关闭",
    "card.blankPage": "BLANK PAGE",
    "status.exportDone": "导出完成: {name}",
    "error.noPdfHeader": "未检测到PDF头(%PDF-)。请确认文件是PDF。",
    "status.editNotAllowed": "不可编辑: {detail}",
    "status.error": "错误: {detail}",
    "status.previewInSiteOn": "已启用站内预览。",
    "status.previewInSiteOff": "已关闭站内预览（轻量模式）。",
    "error.notLoaded": "PDF未加载"
  }
};

initLanguage();

state.previewSupported = !isSafariBrowser();
if (!state.previewSupported) {
  elements.openSourceViewerBtn.textContent = t("status.previewUnsupportedShort");
  elements.openSourceViewerBtn.disabled = true;
  setStatus(t("status.previewUnsupportedInit"));
}

elements.fileInput.addEventListener("change", onFileSelected);
elements.inSitePreviewToggle.addEventListener("change", () => {
  state.inSitePreviewEnabled = elements.inSitePreviewToggle.checked;
  if (state.pages.length) {
    renderPages();
    setStatus(
      state.inSitePreviewEnabled
        ? t("status.previewInSiteOn")
        : t("status.previewInSiteOff"),
      true
    );
  }
});

elements.openSourceViewerBtn.addEventListener("click", () => {
  if (!state.previewSupported) {
    setStatus(t("status.previewUnsupportedUse"), true);
    return;
  }
  if (!state.fileBytes) {
    setStatus(t("status.loadPdfFirst"));
    return;
  }
  openInBrowserViewer(new Blob([state.fileBytes], { type: "application/pdf" }));
  setStatus(t("status.openedInBrowserViewer"), true);
});

elements.showSelectionBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  elements.selectionWorkbench.classList.remove("hidden");
  elements.spreadWorkbench.classList.add("hidden");
  setStatus(t("status.modeSelectionShown"), true);
});

elements.showSpreadBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  elements.spreadWorkbench.classList.remove("hidden");
  elements.selectionWorkbench.classList.add("hidden");
  setStatus(t("status.modeSpreadShown"), true);
});

elements.selectAllBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  state.pages.forEach((p) => (p.selected = true));
  renderPages();
  setStatus(t("status.selectedAll"), true);
});

elements.clearSelectionBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  state.pages.forEach((p) => (p.selected = false));
  renderPages();
  setStatus(t("status.selectionCleared"), true);
});

elements.deleteSelectedBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  if (!requireEditable()) return;
  const afterDelete = state.pages.filter((p) => !p.selected);
  if (!afterDelete.length) {
    setStatus(t("status.cannotDeleteAll"), true);
    return;
  }
  state.pages = afterDelete;
  renderPages();
  setStatus(t("status.deletedSelected"), true);
});

elements.insertBlankStartBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  if (!requireEditable()) return;
  insertBlankAt(0);
  setStatus(t("status.addedBlankStart"), true);
});

elements.insertBlankBetweenBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  if (!requireEditable()) return;
  const n = Number(elements.insertAfterInput.value);
  if (!Number.isInteger(n) || n < 1 || n >= state.pages.length) {
    setStatus(t("status.invalidNRange", { max: Math.max(state.pages.length - 1, 1) }), true);
    return;
  }
  insertBlankAt(n);
  setStatus(t("status.addedBlankBetween", { n, nPlusOne: n + 1 }), true);
});

elements.insertBlankEndBtn.addEventListener("click", () => {
  if (!requireLoaded()) return;
  if (!requireEditable()) return;
  insertBlankAt(state.pages.length);
  setStatus(t("status.addedBlankEnd"), true);
});

elements.exportCurrentBtn.addEventListener("click", () =>
  runBusyTask(t("status.exportingPdf"), async () => {
    if (!requireLoaded()) return;
    if (!requireEditable()) return;
    await exportPdf(state.pages, `${baseName(state.fileName)}_ordered.pdf`);
  })
);

elements.exportSelectedBtn.addEventListener("click", () =>
  runBusyTask(t("status.exportingSelected"), async () => {
    if (!requireLoaded()) return;
    if (!requireEditable()) return;
    const pages = selectedPages();
    if (!pages.length) {
      setStatus(t("status.noSelectedPages"), true);
      return;
    }
    await exportPdf(pages, `${baseName(state.fileName)}_selected.pdf`);
  })
);

elements.rangeSplitExportBtn.addEventListener("click", () =>
  runBusyTask(t("status.exportingRangeZip"), async () => {
    if (!requireLoaded()) return;
    if (!requireEditable()) return;
    const raw = elements.rangeSplitInput.value.trim();
    const groups = parseRangeGroups(raw, state.pages.length);
    if (!groups.length) {
      setStatus(t("status.invalidRangeInput"), true);
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
    setStatus(t("status.exportedRangeZip"), true);
  })
);

elements.spreadBtn.addEventListener("click", () =>
  runBusyTask(t("status.exportingSpread"), async () => {
    if (!requireLoaded()) return;
    if (!requireEditable()) return;
    const bytes = await createSpreadPdf(state.pages, currentBinding());
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName(state.fileName)}_spread.pdf`);
    setStatus(t("status.exportedSpread"), true);
  })
);

elements.spreadSelectedBtn.addEventListener("click", () =>
  runBusyTask(t("status.exportingSpreadSelected"), async () => {
    if (!requireLoaded()) return;
    if (!requireEditable()) return;
    const pages = selectedPages();
    if (!pages.length) {
      setStatus(t("status.selectForSpread"), true);
      return;
    }
    const bytes = await createSpreadPdf(pages, currentBinding());
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName(state.fileName)}_spread_selected.pdf`);
    setStatus(t("status.exportedSpreadSelected"), true);
  })
);

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  await runBusyTask(t("status.loadingPdf"), async () => {
    const raw = await file.arrayBuffer();
    const normalized = normalizePdfBytes(new Uint8Array(raw));

    let appBytes = new Uint8Array(normalized);
    let { doc: pdfjsDoc, usedPassword } = await loadPdfWithPasswordPrompt(normalized);

    if (usedPassword) {
      setStatus(t("status.unlockingPdf"), !elements.workspace.classList.contains("hidden"));
      try {
        appBytes = await flattenAndUnlockPdf(new Uint8Array(normalized), { password: usedPassword });
        await pdfjsDoc.destroy();
        const unlockedTask = pdfjsLib.getDocument({ data: new Uint8Array(appBytes) });
        pdfjsDoc = await unlockedTask.promise;
      } catch (error) {
        if (error instanceof PasswordRequiredError) {
          throw new Error(t("status.passwordRequired"));
        }
        if (error instanceof PdfProcessingError) {
          throw new Error(t("status.unlockFailed", { detail: error.message }));
        }
        throw new Error(t("status.unlockFailed", { detail: formatError(error) }));
      }
    }

    const firstPage = await pdfjsDoc.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1 });
    const streamProbe = await probePdfJsStream(firstPage);

    state.fileName = file.name;
    state.fileBytes = appBytes;
    state.pdfjsDoc = pdfjsDoc;
    state.inSitePreviewEnabled = elements.inSitePreviewToggle.checked;
    state.defaultPageSize = {
      width: Math.max(1, Math.round(firstViewport.width)),
      height: Math.max(1, Math.round(firstViewport.height))
    };
    const editCheck = await assessEditability(appBytes);
    state.editable = editCheck.editable;
    state.useIgnoreEncryption = editCheck.useIgnoreEncryption;
    state.editErrorDetail = editCheck.detail;
    state.editWarningCode = editCheck.code || "";

    if (!streamProbe.ok) {
      state.editable = false;
      state.useIgnoreEncryption = false;
      state.editWarningCode = "stream";
      state.editErrorDetail = streamProbe.detail;
    }

    state.pages = Array.from({ length: pdfjsDoc.numPages }, (_, i) => createSourcePageEntry(i));

    elements.startScreen.classList.add("hidden");
    elements.workspace.classList.remove("hidden");
    elements.selectionWorkbench.classList.add("hidden");
    elements.spreadWorkbench.classList.add("hidden");
    elements.fileSummary.textContent = t("status.fileSummary", { name: file.name, pages: pdfjsDoc.numPages });
    elements.insertAfterInput.value = "";
    elements.rangeSplitInput.value = "";

    await renderPages();
    if (!state.editable) {
      setStatus(t("status.loadDoneNotEditable", { detail: state.editErrorDetail }), true);
    } else if (pdfjsDoc.numPages >= 100 && state.inSitePreviewEnabled) {
      setStatus(t("status.loadDoneHeavyAdvice", { name: file.name }), true);
    } else if (state.useIgnoreEncryption) {
      setStatus(t("status.loadDoneCompat"), true);
    } else {
      setStatus(t("status.loadDone", { name: file.name }), true);
    }
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
    indexEl.textContent = t("card.order", { num: idx + 1 });
    card.append(indexEl);

    const originalEl = document.createElement("div");
    originalEl.className = "page-original";
    originalEl.textContent = pageState.isBlank
      ? t("card.blank")
      : t("card.original", { num: pageState.srcIndex + 1 });
    card.append(originalEl);

    if (state.inSitePreviewEnabled) {
      const canvas = document.createElement("canvas");
      canvas.width = 150;
      canvas.height = 200;
      card.append(canvas);

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
          ctx.fillText(t("card.previewFailed"), 20, 24);
        });
      }
    } else {
      const off = document.createElement("div");
      off.className = "page-thumb-off";
      off.textContent = t("card.previewOff");
      card.append(off);
    }

    fragment.append(card);
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
  ctx.fillText(t("card.blankPage"), 28, 104);
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
  setStatus(t("status.exportDone", { name: fileName }), true);
}

async function createPdfFromEntries(pageEntries) {
  if (!state.fileBytes) throw new Error(t("error.notLoaded"));
  if (!state.editable) {
    throw new Error(t("status.editNotAllowed", { detail: state.editErrorDetail }));
  }
  const src = await PDFDocument.load(state.fileBytes, pdfLoadOptions());
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
  if (!state.fileBytes) throw new Error(t("error.notLoaded"));
  if (!state.editable) {
    throw new Error(t("status.editNotAllowed", { detail: state.editErrorDetail }));
  }
  const src = await PDFDocument.load(state.fileBytes, pdfLoadOptions());
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
    throw new Error(t("error.noPdfHeader"));
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

function requireEditable() {
  if (state.editable) return true;
  setStatus(t("status.editNotAllowed", { detail: state.editErrorDetail }), true);
  return false;
}

function requireLoaded() {
  if (state.pages.length) return true;
  setStatus(t("status.loadPdfFirst"));
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
    setStatus(t("status.error", { detail: error instanceof Error ? error.message : String(error) }), true);
  } finally {
    state.busy = false;
    toggleButtons(false);
  }
}

function toggleButtons(disabled) {
  for (const el of [
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
  elements.openSourceViewerBtn.disabled = disabled || !state.previewSupported;
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

function initLanguage() {
  const saved = localStorage.getItem("pdf-organizer-lang");
  const defaultLang = saved || detectLanguageFromBrowser();
  setLanguage(defaultLang, false);
  elements.langZhBtn.addEventListener("click", () => setLanguage("zh", true));
  elements.langJaBtn.addEventListener("click", () => setLanguage("ja", true));
}

function setLanguage(lang, save = true) {
  state.language = lang === "zh" ? "zh" : "ja";
  document.documentElement.lang = state.language === "zh" ? "zh" : "ja";
  elements.langJaBtn.classList.toggle("is-active", state.language === "ja");
  elements.langZhBtn.classList.toggle("is-active", state.language === "zh");
  applyStaticTexts();
  if (!state.previewSupported) {
    elements.openSourceViewerBtn.textContent = t("status.previewUnsupportedShort");
  }
  if (state.pdfjsDoc && state.fileName) {
    elements.fileSummary.textContent = t("status.fileSummary", { name: state.fileName, pages: state.pdfjsDoc.numPages });
    if (state.pages.length) renderPages();
  }
  if (save) localStorage.setItem("pdf-organizer-lang", state.language);
}

function detectLanguageFromBrowser() {
  const langs = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  return langs.some((l) => l.toLowerCase().startsWith("zh")) ? "zh" : "ja";
}

function applyStaticTexts() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (!key) return;
    el.innerHTML = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.setAttribute("placeholder", t(key));
  });
}

function t(key, vars = {}) {
  const dict = translations[state.language] || translations.ja;
  const fallback = translations.ja;
  let text = dict[key] ?? fallback[key] ?? key;
  for (const [k, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(value));
  }
  return text;
}

function pdfLoadOptions() {
  return state.useIgnoreEncryption ? { ignoreEncryption: true } : undefined;
}

async function assessEditability(bytes) {
  try {
    await PDFDocument.load(new Uint8Array(bytes));
    return {
      editable: true,
      useIgnoreEncryption: false,
      detail: ""
    };
  } catch (error) {
    if (!isEncryptionError(error)) {
      return {
        editable: false,
        useIgnoreEncryption: false,
        detail: formatError(error)
      };
    }
  }

  try {
    await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
    return {
      editable: false,
      useIgnoreEncryption: true,
      code: "encrypted-bypass",
      detail: t("status.encryptedPreviewOnly")
    };
  } catch (error) {
    return {
      editable: false,
      useIgnoreEncryption: false,
      code: isCompressionError(error) ? "stream" : "generic",
      detail: formatError(error)
    };
  }
}

function isEncryptionError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("encrypted") || message.includes("ignoreEncryption");
}

function formatError(error) {
  if (error instanceof Error) {
    return `[${error.name}] ${error.message}`;
  }
  return String(error);
}

async function probePdfJsStream(page) {
  try {
    const viewport = page.getViewport({ scale: 0.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return { ok: true, detail: "" };
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { ok: true, detail: "" };
  } catch (error) {
    const detail = formatError(error);
    if (isCompressionError(error)) {
      return { ok: false, detail };
    }
    return { ok: true, detail: "" };
  }
}

function isCompressionError(error) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes("unknown compression method in flate stream") || message.includes("flate stream");
}

function isSafariBrowser() {
  const ua = navigator.userAgent;
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS|Android/i.test(ua);
  return isSafari;
}

async function loadPdfWithPasswordPrompt(pdfBytes) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes)
  });

  let usedPassword = "";
  let cancelled = false;

  loadingTask.onPassword = (updatePassword, reason) => {
    const retry = Number(reason) === 2;
    const input = window.prompt(retry ? t("status.passwordPromptRetry") : t("status.passwordPrompt"), "");
    if (input === null) {
      cancelled = true;
      void loadingTask.destroy();
      return;
    }
    usedPassword = input;
    updatePassword(input);
  };

  try {
    const doc = await loadingTask.promise;
    return { doc, usedPassword };
  } catch (error) {
    if (cancelled) {
      throw new Error(t("status.passwordCancelled"));
    }
    if (isPasswordError(error)) {
      throw new Error(t("status.passwordRequired"));
    }
    throw error;
  }
}
