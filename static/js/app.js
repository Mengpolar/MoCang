/* ═══════════════════════════════════════════════
   app.js - 入口：事件绑定和初始化
   ═══════════════════════════════════════════════ */

(function() {

    // ── 事件绑定 ──
    function setupEvents() {
        document.getElementById("global-search")?.addEventListener("input", (e) => { clearTimeout(MoCang.searchTimer); MoCang.searchTimer = setTimeout(() => MoCang.search(e.target.value), 400); });
        document.addEventListener("click", (e) => { const sb = document.querySelector(".nav-search"); const r = document.getElementById("search-results"); if (r && r.style.display !== "none" && sb && !sb.contains(e.target)) MoCang.closeSearchResults(); });
        document.getElementById("global-search")?.addEventListener("keydown", (e) => { if (e.key === "Escape") MoCang.closeSearchResults(); });
        document.querySelectorAll(".kb-view-btn").forEach(b => b.addEventListener("click", () => MoCang.setViewMode(b.dataset.mode)));
        document.querySelectorAll(".kb-tool-btn").forEach(b => b.addEventListener("click", () => { if (b.dataset.action) MoCang.toolbarAction(b.dataset.action); }));
        document.getElementById("kb-editor")?.addEventListener("keydown", MoCang.handleEditorKeydown);
        document.getElementById("kb-editor")?.addEventListener("input", MoCang.handleEditorInput);
        MoCang.setupDivider();
        MoCang.setupSyncScroll();
        MoCang.setupAutoSave();
        MoCang.setupSelectCopy();
        MoCang.setupRightClickPaste();
        MoCang.setupAiPolish();
        setupSidebarActions();
    }

    // ── 侧边栏操作 ──
    function setupSidebarActions() {
        const dz = document.getElementById("kb-drop-zone");
        if (dz) dz.onclick = (e) => { e.stopPropagation(); MoCang.openNativeFileDialog(); };

        const btnGroup = document.getElementById("btn-create-group");
        if (btnGroup) {
            btnGroup.addEventListener("click", async () => {
                const name = await showPrompt("输入分组名称：", "", "新建分组");
                if (name && name.trim()) {
                    try {
                        const d = await apiJson("/api/groups", {
                            method: "POST",
                            body: JSON.stringify({ name: name.trim() }),
                        });
                        if (d.error) { showAlert(d.error, "错误"); return; }
                        MoCang.groups = d.groups || [];
                        MoCang.renderFileList();
                    } catch (e) { showAlert("创建失败: " + e.message, "错误"); }
                }
            });
        }
    }

    // ── 初始化 ──
    function init() {
        setupEvents();
        MoCang.loadFiles();
        MoCang.updateToolbarState();
    }

    // 暴露 init 供外部调用
    MoCang.init = init;

})();
