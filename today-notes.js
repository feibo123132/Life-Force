"use strict";

// Notes follow the current manor save, including its account and scene boundaries.
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId("today-notes");
  const editor = byId("notes-editor");
  const pageTitle = byId("notes-page-title");
  const rightEditor = byId("notes-right-editor");
  const columns = byId("notes-columns");
  const layout = byId("notes-layout");
  const panes = [
    { editor, title: byId("notes-left-title"), textKey: "content", htmlKey: "html", titleKey: "leftTitle" },
    { editor: rightEditor, title: byId("notes-right-title"), textKey: "rightContent", htmlKey: "rightHtml", titleKey: "rightTitle" },
  ];
  const query = byId("notes-query");
  const search = byId("notes-search");
  const history = byId("notes-history");
  const limit = 10000;
  const drafts = new Map();
  let owner = "", pageId = "", pendingDelete = "", matchIndex = 0;
  let writing, activeEditor = editor, savedRange;
  const clock = iso => new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const label = page => `${new Date(page.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })} ${clock(page.createdAt)}`;
  const pageName = value => typeof value === "string" ? value.trim().slice(0, pageTitle.maxLength) : "";
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
    if (!dialog.open || !pageId || owner !== activeForestSave().key()) return;
    try {
      localStorage.setItem(scrollKey(), String(editor.scrollTop));
      if (!rightEditor.parentElement.hidden) localStorage.setItem(scrollKey() + ":right", String(rightEditor.scrollTop));
    } catch { /* Editing remains available. */ }
  }
  function saveDraft() {
    if (!pageId || owner !== activeForestSave().key()) return false;
    const draft = drafts.get(draftKey());
    if (!draft) return true;
    const current = notes();
    if (!current.pages.some(item => item.id === pageId)) return false;
    const pages = current.pages.map(item => item.id === pageId
      ? { ...item, ...draft, updatedAt: new Date().toISOString() } : item);
    if (!commit({ activePageId: pageId, pages })) return false;
    drafts.delete(draftKey());
    return true;
  }
  function edit(changes) {
    if (!writing || owner !== activeForestSave().key()) return;
    if (Object.keys(changes).every(key => writing[key] === changes[key])) return;
    Object.assign(writing, changes);
    drafts.set(draftKey(), { ...drafts.get(draftKey()), ...changes });
    saveDraft();
  }
  const safeTags = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P", "SPAN", "FONT"]);
  const safeColor = value => /^(?:#[\da-f]{3,8}|rgba?\([\d., %]+\)|transparent)$/i.test(value);
  function cleanMarkup(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    for (const node of template.content.querySelectorAll("*")) {
      if (!safeTags.has(node.tagName) || node.namespaceURI !== "http://www.w3.org/1999/xhtml") {
        node.remove();
        continue;
      }
      const size = node.getAttribute("size") ?? "";
      const color = node.getAttribute("color") ?? "";
      const { fontWeight, fontSize, color: textColor, backgroundColor } = node.style;
      for (const { name } of [...node.attributes]) node.removeAttribute(name);
      if (node.tagName === "FONT") {
        if (/^[2-6]$/.test(size)) node.setAttribute("size", size);
        if (safeColor(color)) node.setAttribute("color", color);
      }
      if (/^(?:normal|bold|[1-9]00)$/.test(fontWeight)) node.style.fontWeight = fontWeight;
      if (/^(?:small|medium|large|xx?-large|1[4-9]px|2[0-8]px)$/.test(fontSize)) node.style.fontSize = fontSize;
      if (safeColor(textColor)) node.style.color = textColor;
      if (safeColor(backgroundColor)) node.style.backgroundColor = backgroundColor;
    }
    return template;
  }
  function editorText(target) {
    return target.childNodes.length === 1 && target.firstChild.nodeName === "BR" ? "" : target.innerText;
  }
  function renderEditor({ editor: target, textKey, htmlKey }) {
    const value = writing[textKey];
    const html = writing[htmlKey];
    // Older clients can update the plain text while retaining unknown format fields.
    if (html) target.replaceChildren(cleanMarkup(html).content);
    if (!html || editorText(target) !== value) target.textContent = value;
    target.toggleAttribute("data-empty", !value);
  }
  function renderLayout() {
    layout.value = columns.dataset.layout = writing.layout;
    const showBoth = writing.layout === "split" || Boolean(writing.rightContent || writing.rightTitle);
    panes[0].title.hidden = !showBoth && !writing.leftTitle;
    rightEditor.parentElement.hidden = !showBoth;
    editor.setAttribute("aria-label", showBoth ? "左栏正文" : "今日事正文");
    if (!showBoth && activeEditor === rightEditor) {
      activeEditor = editor;
      savedRange = undefined;
    }
  }
  function textCount() { return writing.content.length + writing.rightContent.length; }
  function saveEditor(pane) {
    const { editor: target, textKey, htmlKey } = pane;
    if (!writing || !dialog.open) return;
    const value = editorText(target);
    if (textCount() - writing[textKey].length + value.length > limit) {
      renderEditor(pane);
      savedRange = undefined;
    } else {
      const styled = target.querySelector("b, strong, i, em, u, font, [style]");
      edit({ [textKey]: value, [htmlKey]: value && styled ? cleanMarkup(target.innerHTML).innerHTML : "" });
      target.toggleAttribute("data-empty", !value);
    }
    updateCounts();
    updateBold();
  }
  function renderHistory() {
    const current = notes();
    byId("notes-history-toggle").textContent = `历史 ${current.pages.length}`;
    const cards = current.pages.map(page => {
      const isCurrent = page.id === pageId;
      const name = isCurrent ? writing.title : pageName(page.title);
      const date = label(page);
      const card = document.createElement("div");
      card.className = "notes-page-card";
      card.classList.toggle("is-current", isCurrent);
      const select = document.createElement("button");
      select.type = "button";
      if (isCurrent) select.setAttribute("aria-current", "page");
      const title = document.createElement("strong");
      title.textContent = (name || date) + (isCurrent ? " · 当前" : "");
      title.title = title.textContent;
      const preview = document.createElement("span");
      const firstLine = [page.content, page.rightContent].join("\n").split("\n").map(line => line.trim()).find(Boolean) || "空白页";
      const excerpt = firstLine.length > 36 ? firstLine.slice(0, 36) + "…" : firstLine;
      preview.textContent = name ? `${date} · ${excerpt}` : excerpt;
      select.append(title, preview);
      select.addEventListener("click", () => {
        if (!saveDraft()) return;
        rememberScroll();
        if (commit({ ...notes(), activePageId: page.id })) { pendingDelete = ""; renderPage(); }
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "notes-delete";
      remove.setAttribute("aria-label", `删除 ${name || date} 这一页`);
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
  function findRanges(target, pattern) {
    let text = "";
    const nodes = [];
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE && node.length) {
        nodes.push({ node, start: text.length, end: text.length + node.length });
        text += node.data.replace(/\u00a0/g, " ");
        return;
      }
      const block = node.matches?.("br, div, p");
      if (block) text += "\n";
      for (const child of node.childNodes) visit(child);
      if (block) text += "\n";
    }
    for (const child of target.childNodes) visit(child);
    let index = 0;
    return Array.from(text.matchAll(pattern), match => {
      const start = match.index;
      const end = start + match[0].length - 1;
      while (start >= nodes[index].end) index++;
      const first = nodes[index];
      while (end >= nodes[index].end) index++;
      const last = nodes[index];
      const range = new Range();
      range.setStart(first.node, start - first.start);
      range.setEnd(last.node, end - last.start + 1);
      return { range, target };
    });
  }
  function updateSearch(move = false) {
    const literal = query.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = literal && !search.hidden ? new RegExp(literal, "giu") : null;
    const matches = pattern ? panes.flatMap(({ editor: target }) =>
      target.parentElement.hidden ? [] : findRanges(target, pattern)) : [];
    matchIndex = matches.length ? (matchIndex + matches.length) % matches.length : 0;
    byId("notes-match-count").textContent = !query.value ? "" : matches.length ? `${matchIndex + 1} / ${matches.length}` : "无匹配";
    byId("notes-prev").disabled = byId("notes-next").disabled = !matches.length;
    const current = matches[matchIndex];
    if (globalThis.CSS?.highlights && typeof Highlight === "function") {
      CSS.highlights.delete("forest-notes-found");
      CSS.highlights.delete("forest-notes-current");
      if (current) {
        const others = new Highlight();
        matches.forEach(({ range }, index) => { if (index !== matchIndex) others.add(range); });
        CSS.highlights.set("forest-notes-found", others);
        CSS.highlights.set("forest-notes-current", new Highlight(current.range));
      }
    }
    if (move && current) {
      const { target, range } = current;
      const box = target.getBoundingClientRect();
      const match = range.getBoundingClientRect();
      const offset = match.top - box.top;
      target.scrollTop = Math.max(0, target.scrollTop + offset - target.clientHeight / 3);
      const afterScroll = range.getBoundingClientRect();
      const viewport = dialog.getBoundingClientRect();
      if (afterScroll.top < viewport.top || afterScroll.bottom > viewport.bottom) {
        dialog.scrollTop += afterScroll.top - viewport.top - dialog.clientHeight / 3;
      }
    }
  }
  function updateCounts() {
    const count = textCount();
    byId("notes-count").textContent = `${count} / ${limit}`;
    byId("notes-remaining").textContent = `${limit - count <= 500 ? "只剩" : "还能写"} ${limit - count} 字`;
    updateSearch();
  }
  function renderPage() {
    const { activePageId, pages } = notes();
    const page = pages.find(item => item.id === activePageId);
    if (!page) return;
    pageId = page.id;
    const data = { ...page, ...drafts.get(draftKey()) };
    const content = data.content.slice(0, limit);
    writing = {
      title: pageName(data.title),
      content, rightContent: typeof data.rightContent === "string" ? data.rightContent.slice(0, limit - content.length) : "",
      html: typeof data.html === "string" ? data.html : "", rightHtml: typeof data.rightHtml === "string" ? data.rightHtml : "",
      leftTitle: typeof data.leftTitle === "string" ? data.leftTitle.slice(0, 40) : "",
      rightTitle: typeof data.rightTitle === "string" ? data.rightTitle.slice(0, 40) : "",
      layout: data.layout === "split" ? "split" : "single",
    };
    pageTitle.value = writing.title;
    activeEditor = editor;
    savedRange = undefined;
    renderLayout();
    for (const pane of panes) {
      renderEditor(pane);
      pane.title.value = writing[pane.titleKey];
    }
    byId("notes-date").textContent = label(page);
    byId("notes-date").dateTime = page.createdAt;
    matchIndex = 0;
    updateCounts();
    updateBold();
    renderHistory();
    try {
      editor.scrollTop = Number(localStorage.getItem(scrollKey())) || 0;
      rightEditor.scrollTop = Number(localStorage.getItem(scrollKey() + ":right")) || 0;
    } catch {
      editor.scrollTop = rightEditor.scrollTop = 0;
    }
    if (drafts.has(draftKey())) saveDraft();
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
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    pendingDelete = "";
    globalThis.CSS?.highlights?.delete("forest-notes-found");
    globalThis.CSS?.highlights?.delete("forest-notes-current");
  });
  dialog.addEventListener("cancel", () => { saveDraft(); rememberScroll(); });
  const bold = byId("notes-bold");
  function selectedRange() {
    const selection = getSelection();
    return selection.rangeCount ? selection.getRangeAt(0) : null;
  }
  function updateBold() {
    const range = selectedRange();
    const selected = range && activeEditor.contains(range.commonAncestorContainer);
    bold.setAttribute("aria-pressed", String(Boolean(selected && document.queryCommandState("bold"))));
  }
  function rememberSelection() {
    if (!dialog.open) return;
    const range = selectedRange();
    const pane = panes.find(({ editor: target }) => range && target.contains(range.commonAncestorContainer));
    if (pane && document.activeElement === pane.editor) {
      activeEditor = pane.editor;
      savedRange = range.cloneRange();
      updateBold();
    }
  }
  function focusSelection() {
    const range = savedRange && activeEditor.contains(savedRange.commonAncestorContainer) ? savedRange : new Range();
    if (range !== savedRange) {
      range.selectNodeContents(activeEditor);
      range.collapse(false);
    }
    activeEditor.focus({ preventScroll: true });
    const selection = getSelection();
    const current = selectedRange();
    if (!current || current.compareBoundaryPoints(Range.START_TO_START, range) || current.compareBoundaryPoints(Range.END_TO_END, range)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  function applyFormat(command, value) {
    focusSelection();
    // The browser's editing command preserves native selection and undo history.
    document.execCommand(command, false, value);
    rememberSelection();
    updateBold();
  }
  function availableText(target) {
    const range = selectedRange();
    const selected = range && target.contains(range.commonAncestorContainer) ? getSelection().toString().length : 0;
    return limit - textCount() + selected;
  }
  for (const pane of panes) {
    const target = pane.editor;
    target.addEventListener("focus", () => {
      if (activeEditor !== target) savedRange = undefined;
      activeEditor = target;
    });
    target.addEventListener("input", event => {
      if (!event.isComposing) saveEditor(pane);
    });
    target.addEventListener("compositionend", () => saveEditor(pane));
    target.addEventListener("beforeinput", event => {
      if (event.isComposing || !event.inputType.startsWith("insert")) return;
      if (event.inputType === "insertFromDrop" || (event.data?.length ?? 1) > availableText(target)) event.preventDefault();
    });
    target.addEventListener("paste", event => {
      event.preventDefault();
      const available = Math.max(0, availableText(target));
      const value = (event.clipboardData?.getData("text/plain") ?? "").slice(0, available).replace(/[\ud800-\udbff]$/, "");
      if (value) document.execCommand("insertText", false, value);
    });
    target.addEventListener("drop", event => event.preventDefault());
    target.addEventListener("blur", () => {
      if (!dialog.open) return;
      saveDraft();
      renderLayout();
      updateSearch();
    });
    target.addEventListener("scroll", rememberScroll);
    pane.title.addEventListener("input", () => edit({ [pane.titleKey]: pane.title.value }));
    pane.title.addEventListener("blur", renderLayout);
  }
  document.addEventListener("selectionchange", rememberSelection);
  const check = byId("notes-check");
  const formatControls = { "notes-size": "fontSize", "notes-color": "foreColor", "notes-highlight": "hiliteColor" };
  for (const control of [bold, check, ...Object.keys(formatControls).map(byId)]) {
    control.addEventListener("pointerdown", rememberSelection);
  }
  for (const button of [bold, check]) button.addEventListener("mousedown", event => event.preventDefault());
  bold.addEventListener("click", () => applyFormat("bold"));
  for (const [id, command] of Object.entries(formatControls)) {
    const control = byId(id);
    control.addEventListener("change", () => {
      if (control.value) applyFormat(command, control.value);
      control.value = "";
    });
  }
  check.addEventListener("click", () => {
    focusSelection();
    if (availableText(activeEditor) >= 1) document.execCommand("insertText", false, "✅");
  });
  layout.addEventListener("change", () => {
    edit({ layout: layout.value });
    renderLayout();
    updateSearch();
  });
  function saveTitle() {
    if (!dialog.open || !writing) return;
    edit({ title: pageName(pageTitle.value) });
    if (!history.hidden) renderHistory();
  }
  pageTitle.addEventListener("input", event => { if (!event.isComposing) saveTitle(); });
  pageTitle.addEventListener("compositionend", saveTitle);
  pageTitle.addEventListener("blur", () => {
    if (writing) pageTitle.value = writing.title;
  });
  pageTitle.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
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
  window.addEventListener("pagehide", () => { if (dialog.open) { saveDraft(); rememberScroll(); } });
  window.addEventListener("beforeunload", event => {
    if (dialog.open) saveDraft();
    if (drafts.size) { event.preventDefault(); event.returnValue = ""; }
  });
  globalThis.refreshTodayNotes = () => {
    if (owner !== activeForestSave().key()) {
      dialog.close();
      owner = ""; pageId = ""; writing = undefined; savedRange = undefined;
      pageTitle.value = "";
      for (const pane of panes) { pane.editor.replaceChildren(); pane.title.value = ""; }
      search.hidden = history.hidden = true;
      query.value = "";
      byId("notes-find").setAttribute("aria-expanded", "false");
      byId("notes-history-toggle").setAttribute("aria-expanded", "false");
    } else if (dialog.open && !drafts.has(draftKey())) renderPage();
  };
})();
