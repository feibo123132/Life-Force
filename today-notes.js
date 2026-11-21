"use strict";

// Notes follow the current manor save, including its account and scene boundaries.
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId("today-notes");
  const editor = byId("notes-editor");
  const highlights = byId("notes-highlights");
  const query = byId("notes-query");
  const search = byId("notes-search");
  const history = byId("notes-history");
  const limit = 10000;
  const drafts = new Map();
  let owner = "", pageId = "", pendingDelete = "", matches = [], matchIndex = 0;
  const clock = iso => new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const label = page => `${new Date(page.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })} ${clock(page.createdAt)}`;
  const draftKey = () => `${owner}:${pageId}`;
  const scrollKey = () => `forest-today-note-scroll:${draftKey()}`;
  const newPage = () => {
    const now = new Date().toISOString();
    return { id: crypto.randomUUID(), content: "", createdAt: now, updatedAt: now };
  };
  function notes() {
    const saved = state.todayNotes;
    const pages = Array.isArray(saved?.pages) ? saved.pages.filter(page =>
      typeof page?.id === "string" && typeof page.content === "string" &&
      Number.isFinite(Date.parse(page.createdAt)) && Number.isFinite(Date.parse(page.updatedAt))) : [];
    return { pages, activePageId: pages.some(page => page.id === saved.activePageId) ? saved.activePageId : pages[0]?.id };
  }
  function commit(next) {
    if (owner !== activeForestSave().key()) return false;
    const snapshot = { ...state, todayNotes: next };
    if (!saveState(snapshot)) {
      byId("notes-save-status").textContent = "保存失败，草稿仍在本窗口，请稍后重试";
      byId("notes-save-status").dataset.error = "true";
      return false;
    }
    state = snapshot;
    byId("notes-save-status").textContent = `已保存 ${clock(new Date().toISOString())}`;
    delete byId("notes-save-status").dataset.error;
    return true;
  }
  function rememberScroll() {
    // A hidden textarea reports zero after close; keep the last visible position.
    if (!dialog.open || !pageId || owner !== activeForestSave().key()) return;
    try { localStorage.setItem(scrollKey(), String(editor.scrollTop)); } catch { /* Editing remains available. */ }
  }
  function saveDraft() {
    if (!pageId || owner !== activeForestSave().key()) return false;
    const current = notes();
    const page = current.pages.find(item => item.id === pageId);
    if (!page) return false;
    const content = editor.value.slice(0, limit);
    if (content === page.content) { drafts.delete(draftKey()); return true; }
    drafts.set(draftKey(), content);
    const pages = current.pages.map(item => item.id === pageId
      ? { ...item, content, updatedAt: new Date().toISOString() } : item);
    if (!commit({ activePageId: pageId, pages })) return false;
    drafts.delete(draftKey());
    return true;
  }
  function renderHistory() {
    const current = notes();
    byId("notes-history-toggle").textContent = `历史 ${current.pages.length}`;
    const cards = current.pages.map(page => {
      const card = document.createElement("div");
      card.className = "notes-page-card";
      card.classList.toggle("is-current", page.id === pageId);
      const select = document.createElement("button");
      select.type = "button";
      const title = document.createElement("strong");
      title.textContent = label(page) + (page.id === pageId ? " · 当前" : "");
      const preview = document.createElement("span");
      const firstLine = page.content.split("\n").map(line => line.trim()).find(Boolean) || "空白页";
      preview.textContent = firstLine.length > 36 ? firstLine.slice(0, 36) + "…" : firstLine;
      select.append(title, preview);
      select.addEventListener("click", () => {
        if (!saveDraft()) return;
        rememberScroll();
        if (commit({ ...notes(), activePageId: page.id })) { pendingDelete = ""; renderPage(); }
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "notes-delete";
      remove.setAttribute("aria-label", `删除 ${label(page)} 这一页`);
      remove.textContent = pendingDelete === page.id ? "确认删除" : "删除";
      remove.addEventListener("click", () => {
        if (pendingDelete !== page.id) { pendingDelete = page.id; renderHistory(); return; }
        if (!saveDraft()) return;
        const latest = notes();
        const pages = latest.pages.filter(item => item.id !== page.id);
        if (!pages.length) pages.push(newPage());
        const activePageId = pages.some(item => item.id === pageId) ? pageId : pages[0].id;
        if (!commit({ pages, activePageId })) return;
        pendingDelete = "";
        renderPage();
      });
      card.append(select, remove);
      return card;
    });
    byId("notes-pages").replaceChildren(...cards);
  }
  function syncHighlights() {
    highlights.style.width = `${editor.clientWidth}px`;
    highlights.style.height = `${editor.clientHeight}px`;
    highlights.scrollTop = editor.scrollTop;
    highlights.scrollLeft = editor.scrollLeft;
  }
  function updateSearch(move = false) {
    const text = editor.value;
    const literal = query.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    matches = literal ? Array.from(text.matchAll(new RegExp(literal, "giu")), match => ({ start: match.index, end: match.index + match[0].length })) : [];
    matchIndex = matches.length ? (matchIndex + matches.length) % matches.length : 0;
    byId("notes-match-count").textContent = !query.value ? "" : matches.length ? `${matchIndex + 1} / ${matches.length}` : "无匹配";
    byId("notes-prev").disabled = byId("notes-next").disabled = !matches.length;
    const fragment = document.createDocumentFragment();
    let end = 0;
    matches.forEach((match, index) => {
      fragment.append(document.createTextNode(text.slice(end, match.start)));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(match.start, match.end);
      mark.classList.toggle("is-current", index === matchIndex);
      fragment.append(mark);
      end = match.end;
    });
    fragment.append(document.createTextNode(text.slice(end) + (text.endsWith("\n") ? "\u200b" : "")));
    highlights.replaceChildren(fragment);
    highlights.hidden = search.hidden || !matches.length;
    syncHighlights();
    if (move && !highlights.hidden) {
      const current = highlights.querySelector(".is-current");
      const y = current.getBoundingClientRect().top - highlights.getBoundingClientRect().top + highlights.scrollTop;
      editor.scrollTop = Math.max(0, y - Math.max(search.offsetHeight + 20, editor.clientHeight / 3));
      syncHighlights();
    }
  }
  function updateCounts() {
    const count = editor.value.length;
    byId("notes-count").textContent = `${count} / ${limit}`;
    byId("notes-remaining").textContent = `${limit - count <= 500 ? "只剩" : "还能写"} ${limit - count} 字`;
    updateSearch();
  }
  function renderPage() {
    const page = notes().pages.find(item => item.id === notes().activePageId);
    if (!page) return;
    pageId = page.id;
    editor.value = drafts.get(draftKey()) ?? page.content.slice(0, limit);
    byId("notes-date").textContent = label(page);
    byId("notes-date").dateTime = page.createdAt;
    matchIndex = 0;
    updateCounts();
    renderHistory();
    try { editor.scrollTop = Number(localStorage.getItem(scrollKey())) || 0; } catch { editor.scrollTop = 0; }
    syncHighlights();
  }
  function toggleSearch(open) {
    search.hidden = !open;
    byId("notes-find").setAttribute("aria-expanded", String(open));
    if (open) { query.focus(); query.select(); }
    else { query.value = ""; byId("notes-find").focus(); }
    matchIndex = 0;
    updateSearch();
  }
  function openNotes() {
    owner = activeForestSave().key();
    if (!notes().pages.length) {
      const page = newPage();
      if (!commit({ activePageId: page.id, pages: [page] })) return;
    }
    dialog.showModal();
    renderPage();
    editor.focus({ preventScroll: true });
  }
  byId("open-today-notes").addEventListener("click", openNotes);
  byId("cabin").addEventListener("click", openNotes);
  byId("notes-close").addEventListener("click", () => { saveDraft(); rememberScroll(); dialog.close(); });
  dialog.addEventListener("close", () => { pendingDelete = ""; });
  dialog.addEventListener("cancel", () => { saveDraft(); rememberScroll(); });
  editor.addEventListener("input", () => {
    updateCounts();
    // Persist locally before account/world switches; existing save-sync debounces cloud uploads.
    saveDraft();
  });
  editor.addEventListener("compositionend", () => { updateCounts(); saveDraft(); });
  editor.addEventListener("blur", () => { if (dialog.open) saveDraft(); });
  editor.addEventListener("scroll", () => { syncHighlights(); rememberScroll(); });
  byId("notes-check").addEventListener("click", () => {
    const available = limit - (editor.value.length - (editor.selectionEnd - editor.selectionStart));
    if (available < "✅".length) return;
    editor.setRangeText("✅", editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.focus({ preventScroll: true });
  });
  byId("notes-new").addEventListener("click", () => {
    if (!saveDraft()) return;
    rememberScroll();
    const page = newPage();
    if (commit({ activePageId: page.id, pages: [page, ...notes().pages] })) {
      pendingDelete = "";
      renderPage();
      editor.focus();
    }
  });
  byId("notes-history-toggle").addEventListener("click", () => {
    history.hidden = !history.hidden;
    pendingDelete = "";
    byId("notes-history-toggle").setAttribute("aria-expanded", String(!history.hidden));
    renderHistory();
  });
  byId("notes-find").addEventListener("click", () => toggleSearch(search.hidden));
  byId("notes-search-close").addEventListener("click", () => toggleSearch(false));
  query.addEventListener("input", () => { matchIndex = 0; updateSearch(true); });
  function moveMatch(direction) { matchIndex += direction; updateSearch(true); }
  byId("notes-prev").addEventListener("click", () => moveMatch(-1));
  byId("notes-next").addEventListener("click", () => moveMatch(1));
  dialog.addEventListener("keydown", event => {
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault(); toggleSearch(true);
    } else if (!search.hidden && event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); toggleSearch(false);
    } else if (event.target === query && event.key === "Enter") {
      event.preventDefault(); moveMatch(event.shiftKey ? -1 : 1);
    }
  });
  new ResizeObserver(syncHighlights).observe(editor);
  window.addEventListener("pagehide", () => { if (dialog.open) { saveDraft(); rememberScroll(); } });
  window.addEventListener("beforeunload", event => {
    if (dialog.open) saveDraft();
    if (drafts.size) { event.preventDefault(); event.returnValue = ""; }
  });
  globalThis.refreshTodayNotes = () => {
    if (owner !== activeForestSave().key()) {
      dialog.close();
      owner = ""; pageId = ""; editor.value = "";
      search.hidden = history.hidden = true;
      query.value = "";
      byId("notes-find").setAttribute("aria-expanded", "false");
      byId("notes-history-toggle").setAttribute("aria-expanded", "false");
    } else if (dialog.open && !drafts.has(draftKey())) renderPage();
  };
})();
