/* ═══════════════════════════════════════════════
   files.js - 文件列表管理
   ═══════════════════════════════════════════════ */

(function() {

    // ── 文件列表 ──
    async function loadFiles() {
        const list = document.getElementById("kb-file-list");
        try {
            MoCang.files = await apiJson("/api/files");
            if (list) list.innerHTML = '<div style="padding:12px;color:yellow;font-size:12px;">files loaded: ' + MoCang.files.length + '</div>';
        } catch(e) {
            MoCang.files = [];
            if (list) list.innerHTML = '<div style="padding:12px;color:red;font-size:12px;">files error: ' + e.message + '</div>';
            return;
        }
        try {
            MoCang.groups = (await apiJson("/api/groups")).filter(g => !g.startsWith(":"));
        } catch { MoCang.groups = []; }
        // 检查文件是否存在
        for (const f of MoCang.files) {
            try { f._exists = await checkFileExists(f.id); } catch { f._exists = false; }
        }
        renderFileList();
    }

    async function checkFileExists(id) {
        try {
            const d = await apiJson("/api/content/" + id);
            return !d.error;
        } catch { return false; }
    }

    function renderFileList() {
        const list = document.getElementById("kb-file-list");
        if (!list) return;
        list.innerHTML = "";

        // 顶部根级拖放区
        const rootDrop = document.createElement("div");
        rootDrop.className = "kb-root-drop-zone";
        rootDrop.textContent = "拖放至此移至最外层";
        rootDrop.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes("text/group")) rootDrop.classList.add("drag-over");
        });
        rootDrop.addEventListener("dragleave", () => rootDrop.classList.remove("drag-over"));
        rootDrop.addEventListener("drop", (e) => {
            e.preventDefault();
            rootDrop.classList.remove("drag-over");
            rootDrop.classList.remove("active");
            const groupName = e.dataTransfer.getData("text/group");
            if (groupName && groupName !== "__ungrouped__") MoCang.moveGroupToRoot(groupName);
        });
        list.appendChild(rootDrop);

        // 构建分组树并渲染
        try {
            const tree = MoCang.buildGroupTree(MoCang.files);
            tree.children.forEach(child => MoCang.renderGroupNode(list, child, 0));
        } catch(e) {
            list.innerHTML = '<div style="padding:12px;color:red;">render error: ' + e.message + '</div>';
        }

        // 底部删除区
        MoCang.setupDeleteZone();
    }

    function createFileItem(f) {
        const item = document.createElement("div");
        const isActive = f.id === MoCang.activeFileId;
        const exists = f._exists !== false;
        item.className = "kb-file-item" + (isActive ? " active" : "") + (!exists ? " missing" : "");
        item.dataset.id = f.id;
        item.draggable = true;

        // 拖拽
        item.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", f.id);
            item.classList.add("dragging");
        });
        item.addEventListener("dragend", () => item.classList.remove("dragging"));

        // 拖入文件 → 插入到该文件前面（排序）
        item.addEventListener("dragover", (e) => {
            e.preventDefault();
            const types = e.dataTransfer.types;
            if (types.includes("text/plain")) {
                item.classList.add("drag-over");
            }
            if (typeof MoCang.setupEdgeScroll === 'function') MoCang.setupEdgeScroll(e);
        });
        item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
        item.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.classList.remove("drag-over");
            const fileId = e.dataTransfer.getData("text/plain");
            if (fileId && fileId !== f.id) {
                const draggedFile = MoCang.files.find(ff => ff.id === fileId);
                if (draggedFile) {
                    // 移动到目标文件的分组
                    draggedFile.group = f.group || "";
                    apiJson("/api/files/" + draggedFile.id, { method: "PATCH", body: JSON.stringify({ group: draggedFile.group }) });
                    // 重排：将拖拽文件放到目标文件前面
                    const fromIdx = MoCang.files.indexOf(draggedFile);
                    const toIdx = MoCang.files.indexOf(f);
                    MoCang.files.splice(fromIdx, 1);
                    MoCang.files.splice(toIdx, 0, draggedFile);
                    renderFileList();
                }
            }
        });

        const alias = document.createElement("div");
        alias.className = "kb-file-alias";
        alias.textContent = f.alias;
        alias.title = exists ? "双击编辑备注名" : "文件已丢失";
        if (exists) {
            alias.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                startEditAlias(alias, f);
            });
        }

        const path = document.createElement("div");
        path.className = "kb-file-path";
        path.textContent = exists ? f.path : f.path + " (丢失)";
        path.title = f.path;

        const groupTag = document.createElement("div");
        groupTag.className = "kb-file-group-tag";
        groupTag.textContent = f.group || "未分组";

        const actions = document.createElement("div");
        actions.className = "kb-file-actions";

        const delBtn = document.createElement("button");
        delBtn.className = "kb-file-del";
        delBtn.textContent = "移除";
        delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteFile(f.id); });

        actions.appendChild(delBtn);
        item.appendChild(alias);
        item.appendChild(path);
        item.appendChild(groupTag);
        item.appendChild(actions);

        // 延迟 click 以区分 dblclick（编辑备注）
        let clickTimer = null;
        item.addEventListener("click", (e) => {
            if (!exists) return;
            if (e.target.closest(".alias-edit-input")) return;
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
            clickTimer = setTimeout(() => {
                clickTimer = null;
                if (MoCang.activeFileId === f.id) closeFile();
                else openFile(f.id);
            }, 250);
        });

        return item;
    }

    // ── 编辑备注名 ──
    function startEditAlias(aliasEl, file) {
        if (MoCang.editingAliasId) return;
        MoCang.editingAliasId = file.id;

        const input = document.createElement("input");
        input.type = "text";
        input.value = file.alias;
        input.className = "alias-edit-input";
        aliasEl.textContent = "";
        aliasEl.appendChild(input);
        input.focus();
        input.select();

        let saved = false;
        function save() {
            if (saved) return;
            saved = true;
            MoCang.editingAliasId = null;
            const newAlias = input.value.trim() || file.alias;
            file.alias = newAlias;
            apiJson("/api/files/" + file.id, {
                method: "PATCH",
                body: JSON.stringify({ alias: newAlias }),
            });
            aliasEl.textContent = newAlias;
        }

        input.addEventListener("blur", save);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); input.blur(); }
            if (e.key === "Escape") { input.value = file.alias; input.blur(); }
        });
        input.addEventListener("click", (e) => e.stopPropagation());
        input.addEventListener("dblclick", (e) => e.stopPropagation());
    }

    // ── 关闭文件 ──
    function closeFile() {
        if (MoCang.activeFileId && MoCang.viewMode !== "preview") MoCang.saveEditorContent();
        MoCang.activeFileId = null;
        MoCang.activeFilePath = null;
        MoCang.editorContent = "";
        // 编辑或分屏模式下关闭文件，自动切回预览
        if (MoCang.viewMode === "edit" || MoCang.viewMode === "split") {
            MoCang.viewMode = "preview";
            document.querySelectorAll(".kb-view-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === "preview"));
        }
        document.getElementById("kb-content").innerHTML =
            '<div class="kb-placeholder"><span class="kb-placeholder-icon"><img src="/static/icons/svgs/file.svg" width="64" height="64" style="opacity:0.5;filter:invert(1) brightness(0.8);"></span><p>选择左侧文件查看内容</p></div>';
        document.getElementById("kb-editor").value = "";
        document.getElementById("kb-toc-list").innerHTML = "";
        MoCang.applyViewMode();
        renderFileList();
    }

    // ── 打开文件 ──
    async function openFile(id) {
        if (MoCang.activeFileId && MoCang.viewMode !== "preview") MoCang.saveEditorContent();
        MoCang.activeFileId = id;
        renderFileList();

        const contentEl = document.getElementById("kb-content");
        const editorEl = document.getElementById("kb-editor");
        const tocList = document.getElementById("kb-toc-list");

        try {
            const data = await apiJson("/api/content/" + id);
            if (data.error) { showAlert(data.error, "错误"); return; }
            const entry = MoCang.files.find(f => f.id === id);
            MoCang.activeFilePath = entry ? entry.path : null;
            MoCang.editorContent = data.raw || "";

            contentEl.innerHTML = data.html;
            contentEl.querySelectorAll("pre code").forEach(b => { try { hljs.highlightElement(b); } catch {} });

            if (data.headings && data.headings.length > 0) {
                MoCang.renderToc(data.headings);
            } else {
                tocList.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text-muted);">无标题</div>';
            }
            editorEl.value = MoCang.editorContent;
            MoCang.updateSplitPreview();
            MoCang.applyViewMode();
        } catch (e) {
            contentEl.innerHTML = '<div class="kb-placeholder"><p style="color:var(--danger);">加载失败: ' + e.message + '</p></div>';
            entry._exists = false;
            renderFileList();
        }
    }

    // ── 删除文件 ──
    async function deleteFile(id) {
        var ok = await showConfirm("确定移除此文件索引？\n（不会删除原文件）", "确认移除", true);
        if (!ok) return;
        try {
            await apiJson("/api/files/" + id, { method: "DELETE" });
            MoCang.files = MoCang.files.filter(f => f.id !== id);
            if (MoCang.activeFileId === id) closeFile();
            renderFileList();
        } catch {}
    }

    // ── 打开原生文件对话框 ──
    async function openNativeFileDialog() {
        try {
            const paths = await window.pywebview.api.open_file_dialog();
            if (!paths || paths.length === 0) return;
            for (const fp of paths) {
                if (MoCang.files.some(f => f.path === fp)) { MoCang.showToast("文件已在列表中: " + fp, true); continue; }
                const alias = fp.replace(/^.*[\\/]/, "").replace(/\.md$/i, "");
                try {
                    const d = await apiJson("/api/files", { method: "POST", body: JSON.stringify({ path: fp, alias }) });
                    if (d.error) showAlert(d.error, "错误");
                    else { d._exists = true; MoCang.files.push(d); }
                } catch (err) { showAlert("添加失败: " + err.message, "错误"); }
            }
            renderFileList();
        } catch (err) { showAlert("打开文件对话框失败: " + err.message, "错误"); }
    }

    // ── 暴露到 MoCang 命名空间 ──
    MoCang.loadFiles = loadFiles;
    MoCang.checkFileExists = checkFileExists;
    MoCang.renderFileList = renderFileList;
    MoCang.createFileItem = createFileItem;
    MoCang.startEditAlias = startEditAlias;
    MoCang.closeFile = closeFile;
    MoCang.openFile = openFile;
    MoCang.deleteFile = deleteFile;
    MoCang.openNativeFileDialog = openNativeFileDialog;

})();
