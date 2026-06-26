/* ═══════════════════════════════════════════════
   editor.js - 编辑器工具栏、快捷键、自动保存
   ═══════════════════════════════════════════════ */

(function() {

    // ── 编辑器工具栏 ──
    function toolbarAction(action) {
        const editor = document.getElementById("kb-editor");
        const s = editor.selectionStart, e = editor.selectionEnd;
        const sel = editor.value.substring(s, e);
        let before = "", after = "", rep = "";
        switch (action) {
            case "bold": before = "**"; after = "**"; rep = sel || "粗体文字"; break;
            case "italic": before = "*"; after = "*"; rep = sel || "斜体文字"; break;
            case "strikethrough": before = "~~"; after = "~~"; rep = sel || "删除线文字"; break;
            case "h1": before = "# "; rep = sel || "一级标题"; break;
            case "h2": before = "## "; rep = sel || "二级标题"; break;
            case "h3": before = "### "; rep = sel || "三级标题"; break;
            case "ul": before = "- "; rep = sel || "列表项"; break;
            case "ol": before = "1. "; rep = sel || "列表项"; break;
            case "check": before = "- [ ] "; rep = sel || "任务项"; break;
            case "code": before = "`"; after = "`"; rep = sel || "code"; break;
            case "codeblock": before = "```\n"; after = "\n```"; rep = sel || "code"; break;
            case "quote": before = "> "; rep = sel || "引用文字"; break;
            case "link": before = "["; after = "](url)"; rep = sel || "链接文字"; break;
            case "table": rep = "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |"; break;
            case "hr": rep = "\n---\n"; break;
            case "save": saveFile(); return;
        }
        editor.setRangeText(before + rep + after, s, e, "end");
        editor.focus();
        if (MoCang.viewMode === "split") { clearTimeout(editor._previewTimer); editor._previewTimer = setTimeout(updateSplitPreview, 300); }
    }

    // ── 快捷键 ──
    function handleEditorKeydown(e) {
        const editor = e.target, s = editor.selectionStart, end = editor.selectionEnd;
        const mod = (navigator.platform.toUpperCase().indexOf("MAC") >= 0) ? e.metaKey : e.ctrlKey;
        if (mod && e.key === "s") { e.preventDefault(); saveFile(); return; }
        if (mod && (e.key === "a" || e.key === "c" || e.key === "x" || e.key === "v")) return;
        if (mod && e.key === "z" && !e.shiftKey) return;
        if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) return;
        if (mod && e.key === "b") { e.preventDefault(); toolbarAction("bold"); return; }
        if (mod && e.key === "i") { e.preventDefault(); toolbarAction("italic"); return; }
        if (mod && e.key === "k") { e.preventDefault(); toolbarAction("link"); return; }
        if (mod && e.shiftKey && e.key === "K") { e.preventDefault(); toolbarAction("code"); return; }
        if (mod && e.shiftKey && e.key === "C") { e.preventDefault(); toolbarAction("codeblock"); return; }
        if (mod && e.shiftKey && e.key === "Q") { e.preventDefault(); toolbarAction("quote"); return; }
        if (mod && e.shiftKey && e.key === "X") { e.preventDefault(); toolbarAction("strikethrough"); return; }
        if (e.key === "Tab") {
            e.preventDefault();
            if (e.shiftKey) {
                const ls = editor.value.lastIndexOf("\n", s - 1) + 1;
                if (editor.value.substring(ls, s).startsWith("    ")) editor.setRangeText("", ls, ls + 4, "start");
                else if (editor.value.substring(ls, s).startsWith("\t")) editor.setRangeText("", ls, ls + 1, "start");
            } else { editor.setRangeText("    ", s, s, "end"); }
            return;
        }
        if (e.key === "Enter") {
            const ls = editor.value.lastIndexOf("\n", s - 1) + 1;
            const line = editor.value.substring(ls, s);
            let prefix = "";
            const ul = line.match(/^(\s*[-*+]\s)/); if (ul) prefix = ul[1];
            const ol = line.match(/^(\s*\d+\.\s)/); if (ol) prefix = ol[1].replace(/\d+/, String(parseInt(ol[1]) + 1));
            const ck = line.match(/^(\s*- \[[ x]\]\s)/i); if (ck) prefix = ck[1];
            const qt = line.match(/^(\s*>\s)/); if (qt) prefix = qt[1];
            if (prefix) { e.preventDefault(); editor.setRangeText("\n" + prefix, s, end, "end"); }
        }
    }

    function handleEditorInput() {
        MoCang.editorDirty = true;
        if (MoCang.viewMode === "split") { clearTimeout(document.getElementById("kb-editor")._previewTimer); document.getElementById("kb-editor")._previewTimer = setTimeout(updateSplitPreview, 300); }
    }

    function saveEditorContent() { MoCang.editorContent = document.getElementById("kb-editor").value; }

    // ── 保存文件 ──
    async function saveFile() {
        if (!MoCang.activeFileId || !MoCang.activeFilePath) return;
        try {
            const d = await apiJson("/api/save/" + MoCang.activeFileId, { method: "POST", body: JSON.stringify({ content: document.getElementById("kb-editor").value }) });
            if (d.ok) { MoCang.editorContent = document.getElementById("kb-editor").value; MoCang.editorDirty = false; showToast("已保存"); }
            else { showToast(d.error || "保存失败", true); }
        } catch (e) { showToast("保存失败: " + e.message, true); }
    }

    function showToast(msg, isError) {
        const t = document.createElement("div");
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 20px;border-radius:8px;font-size:13px;background:' + (isError ? 'rgba(255,71,87,0.9)' : 'rgba(46,213,115,0.9)') + ';color:#fff;backdrop-filter:blur(10px);animation:fadeIn 0.3s ease;';
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.3s"; setTimeout(() => t.remove(), 300); }, 2000);
    }

    // ── 分屏拖动条 ──
    function setupDivider() {
        const divider = document.getElementById("kb-divider");
        const editor = document.getElementById("kb-editor");
        const splitPreview = document.getElementById("kb-preview-split");
        const editorArea = document.getElementById("kb-editor-area");
        divider.addEventListener("mousedown", (e) => { e.preventDefault(); MoCang.isDragging = true; divider.classList.add("dragging"); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; });
        document.addEventListener("mousemove", (e) => {
            if (!MoCang.isDragging) return;
            const rect = editorArea.getBoundingClientRect();
            const pct = Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100));
            editor.style.width = pct + "%"; editor.style.flex = "none"; splitPreview.style.flex = "1";
        });
        document.addEventListener("mouseup", () => { if (MoCang.isDragging) { MoCang.isDragging = false; divider.classList.remove("dragging"); document.body.style.cursor = ""; document.body.style.userSelect = ""; } });
    }

    // ── 分屏同步滚动 ──
    let syncScrollLock = false;
    function setupSyncScroll() {
        const editor = document.getElementById("kb-editor");
        const preview = document.getElementById("kb-preview-split");
        editor.addEventListener("scroll", () => {
            if (syncScrollLock) return; syncScrollLock = true;
            const p = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
            preview.scrollTop = p * (preview.scrollHeight - preview.clientHeight);
            requestAnimationFrame(() => syncScrollLock = false);
        });
        preview.addEventListener("scroll", () => {
            if (syncScrollLock) return; syncScrollLock = true;
            const p = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
            editor.scrollTop = p * (editor.scrollHeight - editor.clientHeight);
            requestAnimationFrame(() => syncScrollLock = false);
        });
    }

    // ── 自动保存 ──
    function setupAutoSave() {
        MoCang.autoSaveTimer = setInterval(async () => {
            if (!MoCang.editorDirty || !MoCang.activeFileId) return;
            const editor = document.getElementById("kb-editor");
            if (!editor) return;
            try {
                const d = await apiJson("/api/save/" + MoCang.activeFileId, { method: "POST", body: JSON.stringify({ content: editor.value }) });
                if (d.ok) { MoCang.editorContent = editor.value; MoCang.editorDirty = false; }
            } catch {}
        }, MoCang.AUTO_SAVE_INTERVAL);
    }

    function setAutoSaveInterval(ms) {
        if (MoCang.autoSaveTimer) { clearInterval(MoCang.autoSaveTimer); MoCang.autoSaveTimer = null; }
        if (ms > 0) {
            MoCang.autoSaveTimer = setInterval(async () => {
                if (!MoCang.editorDirty || !MoCang.activeFileId) return;
                const editor = document.getElementById("kb-editor");
                if (!editor) return;
                try { const d = await apiJson("/api/save/" + MoCang.activeFileId, { method: "POST", body: JSON.stringify({ content: editor.value }) }); if (d.ok) { MoCang.editorContent = editor.value; MoCang.editorDirty = false; } } catch {}
            }, ms);
        }
    }

    function updateSplitPreview() {
        if (MoCang.viewMode !== "split") return;
        const sp = document.getElementById("kb-preview-split");
        try {
            sp.innerHTML = marked.parse(document.getElementById("kb-editor").value);
            sp.querySelectorAll("pre code").forEach(b => { try { hljs.highlightElement(b); } catch {} });
        } catch { sp.textContent = document.getElementById("kb-editor").value; }
    }

    // ── 暴露到 MoCang 命名空间 ──
    MoCang.toolbarAction = toolbarAction;
    MoCang.handleEditorKeydown = handleEditorKeydown;
    MoCang.handleEditorInput = handleEditorInput;
    MoCang.saveEditorContent = saveEditorContent;
    MoCang.saveFile = saveFile;
    MoCang.showToast = showToast;
    MoCang.setupDivider = setupDivider;
    MoCang.setupSyncScroll = setupSyncScroll;
    MoCang.setupAutoSave = setupAutoSave;
    MoCang.setAutoSaveInterval = setAutoSaveInterval;
    MoCang.updateSplitPreview = updateSplitPreview;

})();
