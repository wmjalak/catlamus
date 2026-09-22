'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  rootPath: null,
  currentFile: null,
  showText: true,
  showMarkdown: false,
  dirty: false,
  saveTimeout: null,
  expanded: new Set(),
  fileOrders: {},   // { folderPath: [fileName, ...] } — user-defined fixed order
};

// ── DOM refs ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fileTree      = $('file-tree');
const editor        = $('editor');
const mdSplitContent = $('md-split-content');
const resizerLeft   = $('resizer-left');
const sidebar       = $('sidebar');
const filenameEl    = $('current-filename');
const saveIndicator = $('save-indicator');
const folderLabel   = $('folder-label');
const toolbar       = $('toolbar');
const contextMenu   = $('context-menu');

// ── Context menu ──────────────────────────────────────────────────────────────
let ctxTarget = null;

function showContextMenu(x, y, item, entry) {
  ctxTarget = { item, entry };
  contextMenu.style.left = x + 'px';
  contextMenu.style.top  = y + 'px';
  contextMenu.classList.add('visible');
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth)  contextMenu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) contextMenu.style.top = (y - rect.height) + 'px';
}

function hideContextMenu() {
  contextMenu.classList.remove('visible');
  ctxTarget = null;
}

document.addEventListener('mousedown', (e) => { if (!contextMenu.contains(e.target)) hideContextMenu(); });
document.addEventListener('keydown',   (e) => { if (e.key === 'Escape') hideContextMenu(); });

$('ctx-rename').addEventListener('click', () => {
  if (!ctxTarget) return;
  const { item, entry } = ctxTarget;
  hideContextMenu();
  startRename(item, entry);
});

$('ctx-delete').addEventListener('click', async () => {
  if (!ctxTarget) return;
  const { entry } = ctxTarget;
  hideContextMenu();
  await deleteFile(entry);
});

// ── Marked setup ────────────────────────────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true });


// ── Render preview ──────────────────────────────────────────────────────────
function renderPreview() {
  if (!state.showMarkdown) return;
  let html = marked.parse(editor.value || '');
  if (state.currentFile) {
    const dir = state.currentFile.substring(0, state.currentFile.lastIndexOf('/'));
    html = html.replace(
      /(<img[^>]+src=")(?!https?:\/\/|file:\/\/|data:)([^"]+)(")/g,
      (_, pre, imgPath, post) => `${pre}file://${dir}/${imgPath}${post}`
    );
  }
  mdSplitContent.innerHTML = html;
  renderPreviewHighlights();
}

// ── Mode toggle ───────────────────────────────────────────────────────────────
let editorSplitWidth = null;

function updatePanels() {
  const pane = $('editor-pane');
  pane.classList.toggle('mode-text',     state.showText);
  pane.classList.toggle('mode-markdown', state.showMarkdown);

  $('btn-mode-text').classList.toggle('active', state.showText);
  $('btn-mode-md').classList.toggle('active',   state.showMarkdown);

  if (state.showText && state.showMarkdown && editorSplitWidth) {
    editor.style.flex  = 'none';
    editor.style.width = editorSplitWidth + 'px';
  } else if (!(state.showText && state.showMarkdown)) {
    editor.style.flex  = '1';
    editor.style.width = '';
  }

  if (state.showMarkdown) renderPreview();
}

$('btn-mode-text').addEventListener('click', () => {
  if (state.showText && !state.showMarkdown) return; // last active panel
  state.showText = !state.showText;
  updatePanels();
});
$('btn-mode-md').addEventListener('click', () => {
  if (state.showMarkdown && !state.showText) return; // last active panel
  state.showMarkdown = !state.showMarkdown;
  updatePanels();
});

// ── Formatting toolbar ────────────────────────────────────────────────────────
function applyFormat(action) {
  if (!state.currentFile) return;
  editor.focus();

  const s   = editor.selectionStart;
  const e   = editor.selectionEnd;
  const v   = editor.value;
  const sel = v.slice(s, e);
  const pre = v.slice(0, s);
  const post = v.slice(e);

  function wrap(open, close, placeholder = '') {
    const content = sel || placeholder;
    editor.value = pre + open + content + close + post;
    if (sel) {
      editor.setSelectionRange(s + open.length, s + open.length + sel.length);
    } else {
      editor.setSelectionRange(s + open.length, s + open.length + placeholder.length);
    }
  }

  function linePrefix(prefix) {
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    const le = (() => { const i = v.indexOf('\n', s); return i === -1 ? v.length : i; })();
    const line = v.slice(ls, le);
    if (line.startsWith(prefix)) {
      editor.value = v.slice(0, ls) + line.slice(prefix.length) + v.slice(le);
      editor.setSelectionRange(Math.max(ls, s - prefix.length), Math.max(ls, s - prefix.length));
    } else {
      editor.value = v.slice(0, ls) + prefix + line + v.slice(le);
      editor.setSelectionRange(s + prefix.length, s + prefix.length);
    }
  }

  switch (action) {
    case 'bold':      wrap('**', '**', 'bold text'); break;
    case 'italic':    wrap('*', '*', 'italic text'); break;
    case 'strike':    wrap('~~', '~~', 'strikethrough'); break;
    case 'h1':        linePrefix('# '); break;
    case 'h2':        linePrefix('## '); break;
    case 'h3':        linePrefix('### '); break;
    case 'code':      wrap('`', '`', 'code'); break;
    case 'codeblock': {
      const inner = sel || 'code here';
      const block = '```\n' + inner + '\n```';
      editor.value = pre + block + post;
      editor.setSelectionRange(s + 4, s + 4 + inner.length);
      break;
    }
    case 'link': {
      if (sel) {
        editor.value = pre + '[' + sel + '](url)' + post;
        editor.setSelectionRange(s + sel.length + 3, s + sel.length + 6);
      } else {
        editor.value = pre + '[link text](url)' + post;
        editor.setSelectionRange(s + 1, s + 10);
      }
      break;
    }
    case 'ul':    linePrefix('- '); break;
    case 'ol':    linePrefix('1. '); break;
    case 'quote': linePrefix('> '); break;
    case 'hr': {
      const ins = '\n\n---\n\n';
      editor.value = pre + ins + post;
      editor.setSelectionRange(s + ins.length, s + ins.length);
      break;
    }
  }

  editor.dispatchEvent(new Event('input'));
}

toolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tb-btn');
  if (btn && btn.dataset.action) applyFormat(btn.dataset.action);
});

// ── File order (user-defined, fixed) ─────────────────────────────────────────
// Files are shown in a fixed order per folder. New files (not yet in the saved
// order) are appended alphabetically. The order is persisted to settings and
// changed only by dragging.
function orderFiles(folder, files) {
  const order = state.fileOrders[folder] || [];
  const byName = new Map(files.map(f => [f.name, f]));
  const result = [];
  for (const name of order) {
    if (byName.has(name)) { result.push(byName.get(name)); byName.delete(name); }
  }
  const rest = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return result.concat(rest);
}

function persistOrder() {
  if (!state.rootPath) return;
  state.fileOrders[state.rootPath] =
    [...fileTree.querySelectorAll('.tree-item')].map(el => el.dataset.path.split('/').pop());
  window.api.setSetting('fileOrders', state.fileOrders);
}

// ── File tree (flat list of markdown files only) ─────────────────────────────
async function loadTree(dirPath, container) {
  const entries = await window.api.readDir(dirPath);
  const files = orderFiles(dirPath, entries.filter(e => !e.isDir));
  container.innerHTML = '';

  if (files.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clip-rule="evenodd"/>
          <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 01-2-2v-2z"/>
        </svg>
        <p>No markdown files in this folder</p>
      </div>`;
    return;
  }

  for (const entry of files) {
    const item = document.createElement('div');
    item.className = 'tree-item file';
    item.dataset.path = entry.path;
    item.draggable = true;

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.setAttribute('fill', 'currentColor');
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('fill-rule', 'evenodd');
    iconPath.setAttribute('d', 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z');
    iconPath.setAttribute('clip-rule', 'evenodd');

    icon.appendChild(iconPath);
    item.appendChild(icon);
    item.appendChild(document.createTextNode(entry.name));

    if (state.currentFile === entry.path) item.classList.add('active');
    item.addEventListener('click', () => openFile(entry.path));
    item.addEventListener('dblclick', (e) => { e.stopPropagation(); startRename(item, entry); });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, item, entry);
    });

    item.addEventListener('dragstart', () => { dragEl = item; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragEl = null;
      persistOrder();
    });

    container.appendChild(item);
  }
}

// ── Drag-to-reorder ───────────────────────────────────────────────────────────
let dragEl = null;

function dragAfterElement(y) {
  const items = [...fileTree.querySelectorAll('.tree-item:not(.dragging)')];
  let closest = { offset: -Infinity, element: null };
  for (const child of items) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  }
  return closest.element;
}

fileTree.addEventListener('dragover', (e) => {
  if (!dragEl) return;
  e.preventDefault();
  const after = dragAfterElement(e.clientY);
  if (after == null) fileTree.appendChild(dragEl);
  else if (after !== dragEl) fileTree.insertBefore(dragEl, after);
});

function refreshActiveItem() {
  document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
  if (state.currentFile) {
    const el = fileTree.querySelector(`[data-path="${CSS.escape(state.currentFile)}"]`);
    if (el) el.classList.add('active');
  }
}

// ── Inline rename ─────────────────────────────────────────────────────────────
function startRename(item, entry) {
  const textNode = [...item.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
  if (!textNode) return;
  item.removeChild(textNode);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-input';
  input.value = entry.name;
  item.appendChild(input);

  input.focus();
  const dotIdx = entry.name.lastIndexOf('.');
  input.setSelectionRange(0, dotIdx > 0 ? dotIdx : entry.name.length);

  async function commit() {
    const newName = input.value.trim();
    item.removeChild(input);
    item.appendChild(document.createTextNode(newName || entry.name));

    if (!newName || newName === entry.name) return;

    const dir = entry.path.substring(0, entry.path.lastIndexOf('/'));
    const newPath = dir + '/' + newName;
    const result = await window.api.renameFile(entry.path, newPath);

    if (result.ok) {
      if (state.currentFile === entry.path) {
        state.currentFile = newPath;
        filenameEl.textContent = newName;
      }
      entry.path = newPath;
      entry.name = newName;
      item.dataset.path = newPath;
      persistOrder();
    } else {
      item.removeChild(item.lastChild);
      item.appendChild(document.createTextNode(entry.name));
    }
  }

  function cancel() {
    item.removeChild(input);
    item.appendChild(document.createTextNode(entry.name));
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    e.stopPropagation();
  });
  input.addEventListener('blur', commit);
}

// ── Delete file ───────────────────────────────────────────────────────────────
async function deleteFile(entry) {
  const confirmed = await window.api.showConfirm(
    `Delete "${entry.name}"?`,
    'This action cannot be undone.'
  );
  if (!confirmed) return;

  const result = await window.api.deleteFile(entry.path);
  if (!result.ok) return;

  if (state.currentFile === entry.path) {
    state.currentFile = null;
    state.dirty = false;
    editor.value = '';
    editor.disabled = true;
    toolbar.classList.add('disabled');
    filenameEl.textContent = 'No file open';
    mdSplitContent.innerHTML = '';
    updateSaveIndicator();
  }

  if (state.rootPath) await loadTree(state.rootPath, fileTree);
}

// ── Open folder ─────────────────────────────────────────────────────────────
async function openFolder(folderPath) {
  state.rootPath = folderPath;
  state.expanded.clear();
  const parts = folderPath.split('/');
  folderLabel.textContent = parts[parts.length - 1] || folderPath;
  window.api.setSetting('lastFolder', folderPath);
  await loadTree(folderPath, fileTree);
}

// ── Open file ───────────────────────────────────────────────────────────────
async function openFile(filePath) {
  if (state.dirty) await save();

  const content = await window.api.readFile(filePath);
  if (content === null) return;

  state.currentFile = filePath;
  state.dirty = false;
  editor.value = content;
  editor.disabled = false;
  toolbar.classList.remove('disabled');

  const parts = filePath.split('/');
  filenameEl.textContent = parts[parts.length - 1];
  updateSaveIndicator();
  renderPreview();
  refreshActiveItem();
  refreshSearch();
  window.api.setSetting('lastFile', filePath);
}

// ── Save ─────────────────────────────────────────────────────────────────────
async function save() {
  if (!state.currentFile) return;
  const ok = await window.api.writeFile(state.currentFile, editor.value);
  if (ok) {
    state.dirty = false;
    updateSaveIndicator();
    await window.api.cleanImages(state.currentFile);
    if (state.rootPath) {
      await loadTree(state.rootPath, fileTree);
      refreshActiveItem();
    }
  }
}

function scheduleAutosave() {
  clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(save, 30000);
}

function updateSaveIndicator() {
  if (state.dirty) {
    saveIndicator.textContent = 'Unsaved';
    saveIndicator.className = 'unsaved';
  } else {
    saveIndicator.textContent = 'Saved';
    saveIndicator.className = 'saved';
  }
}

// ── New file ─────────────────────────────────────────────────────────────────
async function newFile() {
  const filePath = await window.api.newFile(state.rootPath);
  if (!filePath) return;
  if (state.rootPath) await loadTree(state.rootPath, fileTree);
  await openFile(filePath);
}

// ── Resizer drag ──────────────────────────────────────────────────────────────
function makeResizer(resizerEl, getLeft, getRight, setLeft, onEnd) {
  let dragging = false, startX, startLeft, startRight;

  resizerEl.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startLeft = getLeft();
    startRight = getRight();
    resizerEl.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    setLeft(Math.max(160, Math.min(startLeft + dx, startLeft + startRight - 160)));
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizerEl.classList.remove('dragging');
    document.body.style.cursor = '';
    if (onEnd) onEnd();
  });
}

makeResizer(
  resizerLeft,
  () => sidebar.offsetWidth,
  () => $('editor-pane').offsetWidth,
  (w) => { sidebar.style.width = w + 'px'; }
);

makeResizer(
  $('resizer-center'),
  () => editor.offsetWidth,
  () => $('md-split-view').offsetWidth,
  (w) => { editorSplitWidth = w; editor.style.flex = 'none'; editor.style.width = w + 'px'; },
  () => window.api.setSetting('editorSplit', editorSplitWidth)
);

// ── Scroll sync ───────────────────────────────────────────────────────────────
const mdSplitView = $('md-split-view');
let scrollingSrc = null;

function syncScroll(from, to) {
  if (scrollingSrc && scrollingSrc !== from) return;
  scrollingSrc = from;
  const pct = from.scrollTop / (from.scrollHeight - from.clientHeight || 1);
  to.scrollTop = pct * (to.scrollHeight - to.clientHeight);
  requestAnimationFrame(() => { scrollingSrc = null; });
}

editor.addEventListener('scroll', () => syncScroll(editor, mdSplitView));
mdSplitView.addEventListener('scroll', () => syncScroll(mdSplitView, editor));

// ── Editor events ─────────────────────────────────────────────────────────────
// ── Image paste ───────────────────────────────────────────────────────────────
editor.addEventListener('paste', async (e) => {
  if (!state.currentFile) return;
  const imageItem = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
  if (!imageItem) return;
  e.preventDefault();

  const blob = imageItem.getAsFile();
  const ext  = imageItem.type.split('/')[1] || 'png';
  const base64 = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });

  const result = await window.api.saveImage(state.currentFile, base64, ext);
  if (!result.ok) return;

  const md = `![image](${result.relativePath})`;
  const start = editor.selectionStart;
  editor.value = editor.value.slice(0, start) + md + editor.value.slice(editor.selectionEnd);
  editor.selectionStart = editor.selectionEnd = start + md.length;
  editor.dispatchEvent(new Event('input'));
});

editor.addEventListener('input', () => {
  state.dirty = true;
  updateSaveIndicator();
  renderPreview();
  scheduleAutosave();
});

function scrollCursorIntoView() {
  const lineH = fontSize * 1.7;
  const pos   = editor.selectionStart;
  const lines = editor.value.split('\n');
  let lineIdx = 0, charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const end = charCount + lines[i].length;
    if (pos <= end) { lineIdx = i; break; }
    charCount = end + 1;
  }
  const cursorTop    = lineIdx * lineH;
  const cursorBottom = cursorTop + lineH;
  const pad          = lineH * 2;
  if (cursorBottom + pad > editor.scrollTop + editor.clientHeight) {
    editor.scrollTop = cursorBottom + pad - editor.clientHeight;
  } else if (cursorTop - pad < editor.scrollTop) {
    editor.scrollTop = Math.max(0, cursorTop - pad);
  }
}

function moveCursorByLines(delta) {
  const val = editor.value;
  const pos = editor.selectionStart;
  const lines = val.split('\n');

  let lineIdx = 0, charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const end = charCount + lines[i].length;
    if (pos <= end) { lineIdx = i; break; }
    charCount = end + 1;
  }
  const col = pos - charCount;
  const targetLine = Math.max(0, Math.min(lines.length - 1, lineIdx + delta));

  let newPos = 0;
  for (let i = 0; i < targetLine; i++) newPos += lines[i].length + 1;
  newPos += Math.min(col, lines[targetLine].length);

  editor.selectionStart = editor.selectionEnd = newPos;
  scrollCursorIntoView();
}

editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(editor.selectionEnd);
    editor.selectionStart = editor.selectionEnd = start + 2;
  }
  if (e.key === 'PageDown' || e.key === 'PageUp') {
    e.preventDefault();
    const linesPerPage = Math.max(1, Math.floor(editor.clientHeight / (fontSize * 1.7)));
    moveCursorByLines(e.key === 'PageDown' ? linesPerPage : -linesPerPage);
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
    const prevScrollTop = editor.scrollTop;
    requestAnimationFrame(() => {
      const lineH = fontSize * 1.7;
      const delta = editor.scrollTop - prevScrollTop;
      if (Math.abs(delta) > lineH * 1.2) {
        editor.scrollTop = prevScrollTop + Math.sign(delta) * lineH;
      }
    });
  }
});

// ── Find in file ──────────────────────────────────────────────────────────────
const searchBar        = $('search-bar');
const searchInput      = $('search-input');
const searchCount      = $('search-count');
const editorHighlights = $('editor-highlights');
let searchAnchor  = 0;    // position the incremental search starts from
let searchMatches = [];
let searchIndex   = -1;

function findMatches(query) {
  const matches = [];
  if (!query) return matches;
  const text = editor.value.toLowerCase();
  const q = query.toLowerCase();
  let i = text.indexOf(q);
  while (i !== -1) {
    matches.push(i);
    i = text.indexOf(q, i + q.length);
  }
  return matches;
}

function updateSearchCount() {
  if (!searchInput.value) {
    searchCount.textContent = '';
    searchBar.classList.remove('no-results');
    return;
  }
  searchCount.textContent = searchMatches.length === 0 ? 'No results'
    : searchIndex >= 0 ? `${searchIndex + 1} of ${searchMatches.length}`
    : `${searchMatches.length} found`;
  searchBar.classList.toggle('no-results', searchMatches.length === 0);
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function renderHighlights() {
  renderPreviewHighlights();
  if (searchBar.hidden || searchMatches.length === 0) {
    editorHighlights.style.display = 'none';
    editorHighlights.innerHTML = '';
    return;
  }
  // Mirror the textarea's content box exactly (clientWidth excludes its
  // scrollbar) so soft-wrapping lines up between overlay and text.
  editorHighlights.style.left     = editor.offsetLeft + 'px';
  editorHighlights.style.top      = editor.offsetTop + 'px';
  editorHighlights.style.width    = editor.clientWidth + 'px';
  editorHighlights.style.height   = editor.clientHeight + 'px';
  editorHighlights.style.fontSize = fontSize + 'px';

  const v = editor.value;
  const qLen = searchInput.value.length;
  let html = '', last = 0;
  searchMatches.forEach((pos, i) => {
    html += escapeHtml(v.slice(last, pos))
      + `<mark${i === searchIndex ? ' class="current"' : ''}>`
      + escapeHtml(v.slice(pos, pos + qLen))
      + '</mark>';
    last = pos + qLen;
  });
  html += escapeHtml(v.slice(last));
  // Trailing space: a final "\n" renders an empty last line in a textarea
  // but not in a pre-wrap div, which would clamp the overlay's max scroll
  // one line short of the editor's.
  editorHighlights.innerHTML = html + ' ';
  editorHighlights.style.display = 'block';
  editorHighlights.scrollTop = editor.scrollTop;
}

// The preview shows rendered text, so source offsets don't apply there.
// Instead, wrap every case-insensitive occurrence of the query found in the
// preview's text nodes; the "current match" indicator exists only in the editor.
function clearPreviewHighlights() {
  mdSplitContent.querySelectorAll('mark.md-find').forEach(m => {
    m.replaceWith(document.createTextNode(m.textContent));
  });
  mdSplitContent.normalize();
}

function renderPreviewHighlights() {
  clearPreviewHighlights();
  const q = searchInput.value;
  if (searchBar.hidden || !q || !state.showMarkdown) return;
  const needle = q.toLowerCase();
  const walker = document.createTreeWalker(mdSplitContent, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    let i = lower.indexOf(needle);
    if (i === -1) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (i !== -1) {
      frag.appendChild(document.createTextNode(text.slice(last, i)));
      const mark = document.createElement('mark');
      mark.className = 'md-find';
      mark.textContent = text.slice(i, i + needle.length);
      frag.appendChild(mark);
      last = i + needle.length;
      i = lower.indexOf(needle, last);
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
}

function selectMatch() {
  const pos = searchMatches[searchIndex];
  editor.setSelectionRange(pos, pos + searchInput.value.length);
  scrollCursorIntoView();
  updateSearchCount();
  renderHighlights();
}

// Jump to the first match at/after the anchor (used while typing).
function runSearch() {
  searchMatches = findMatches(searchInput.value);
  if (searchMatches.length === 0) {
    searchIndex = -1;
    updateSearchCount();
    renderHighlights();
    return;
  }
  searchIndex = searchMatches.findIndex(p => p >= searchAnchor);
  if (searchIndex === -1) searchIndex = 0;
  selectMatch();
}

// Move to the next (dir=1) or previous (dir=-1) match relative to the
// current editor selection, wrapping around at either end.
function stepSearch(dir) {
  const q = searchInput.value;
  if (!q) return;
  searchMatches = findMatches(q);
  if (searchMatches.length === 0) {
    searchIndex = -1;
    updateSearchCount();
    renderHighlights();
    return;
  }
  if (dir > 0) {
    searchIndex = searchMatches.findIndex(p => p >= editor.selectionEnd);
    if (searchIndex === -1) searchIndex = 0;
  } else {
    searchIndex = -1;
    for (let i = searchMatches.length - 1; i >= 0; i--) {
      if (searchMatches[i] + q.length <= editor.selectionStart) { searchIndex = i; break; }
    }
    if (searchIndex === -1) searchIndex = searchMatches.length - 1;
  }
  selectMatch();
}

// Recompute matches after the document changed under an open find bar,
// without moving the editor selection.
function refreshSearch() {
  if (searchBar.hidden || !searchInput.value) return;
  searchMatches = findMatches(searchInput.value);
  searchIndex = -1;
  updateSearchCount();
  renderHighlights();
}

function openSearch() {
  if (!state.currentFile) return;
  const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  searchBar.hidden = false;
  if (sel && !sel.includes('\n')) searchInput.value = sel;
  searchAnchor = editor.selectionStart;
  searchInput.focus();
  searchInput.select();
  runSearch();
}

function closeSearch() {
  if (searchBar.hidden) return;
  searchBar.hidden = true;
  searchBar.classList.remove('no-results');
  renderHighlights();
  editor.focus();
}

searchInput.addEventListener('input', runSearch);
editor.addEventListener('scroll', () => { editorHighlights.scrollTop = editor.scrollTop; });
editor.addEventListener('input', refreshSearch);
new ResizeObserver(renderHighlights).observe(editor);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  { e.preventDefault(); stepSearch(e.shiftKey ? -1 : 1); }
  if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
});

$('search-prev').addEventListener('click', () => stepSearch(-1));
$('search-next').addEventListener('click', () => stepSearch(1));
$('search-close').addEventListener('click', closeSearch);

// ── Button / menu events ──────────────────────────────────────────────────────
$('btn-open-folder').addEventListener('click', () => window.api.openFolderDialog());
$('btn-new-file').addEventListener('click', newFile);

window.api.onMenuEvent('menu:save', save);
window.api.onMenuEvent('menu:new-file', newFile);
window.api.onFolderOpened(openFolder);

// ── Font size ─────────────────────────────────────────────────────────────────
let fontSize = 14;

function applyFontSize(size) {
  fontSize = Math.max(10, Math.min(32, size));
  editor.style.fontSize = fontSize + 'px';
  window.api.setSetting('fontSize', fontSize);
  renderHighlights();
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 's') { e.preventDefault(); save(); }
  if (mod && e.key === 'b') { e.preventDefault(); applyFormat('bold'); }
  if (mod && e.key === 'i') { e.preventDefault(); applyFormat('italic'); }
  if (mod && e.key === 'k') { e.preventDefault(); applyFormat('link'); }
  if (mod && e.key === 'f') { e.preventDefault(); openSearch(); }
  if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); stepSearch(e.shiftKey ? -1 : 1); }
  if (e.key === 'Escape') closeSearch();
  if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); applyFontSize(fontSize + 1); }
  if (mod && e.key === '-') { e.preventDefault(); applyFontSize(fontSize - 1); }
  if (mod && e.key === '0') { e.preventDefault(); applyFontSize(14); }
});

// ── Initial state ─────────────────────────────────────────────────────────────
editor.disabled = true;
toolbar.classList.add('disabled');
fileTree.innerHTML = `
  <div class="empty-state">
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
    </svg>
    <p>Open a folder to browse your markdown files</p>
  </div>`;

// ── Restore last session ───────────────────────────────────────────────────────
(async () => {
  const [lastFolder, lastFile, savedEditorSplit, savedFontSize, savedOrders] = await Promise.all([
    window.api.getSetting('lastFolder'),
    window.api.getSetting('lastFile'),
    window.api.getSetting('editorSplit'),
    window.api.getSetting('fontSize'),
    window.api.getSetting('fileOrders'),
  ]);
  if (savedOrders && typeof savedOrders === 'object') state.fileOrders = savedOrders;
  if (savedEditorSplit) editorSplitWidth = savedEditorSplit;
  if (savedFontSize) applyFontSize(savedFontSize);
  updatePanels();
  if (lastFolder) await openFolder(lastFolder);
  if (lastFile) await openFile(lastFile);
})();
