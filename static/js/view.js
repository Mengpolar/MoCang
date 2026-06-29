/* ═══════════════════════════════════════════════
   view.js - 视图模式与目录导航
   ═══════════════════════════════════════════════ */

(function() {

    // ── 视图模式 ──
    function setViewMode(mode) {
        // 未选中文件时不能进入编辑或分屏模式
        if ((mode === "edit" || mode === "split") && !MoCang.activeFileId) return;
        MoCang.viewMode = mode;
        document.querySelectorAll(".kb-view-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
        applyViewMode();
    }

    function applyViewMode() {
        const toolbar = document.getElementById("kb-toolbar");
        const editor = document.getElementById("kb-editor");
        const content = document.getElementById("kb-content");
        const divider = document.getElementById("kb-divider");
        const splitPreview = document.getElementById("kb-preview-split");
        const editorArea = document.getElementById("kb-editor-area");

        editor.style.flex = ""; editor.style.width = "";
        content.style.flex = ""; splitPreview.style.flex = "";

        switch (MoCang.viewMode) {
            case "edit":
                toolbar.style.display = "flex"; editorArea.style.flexDirection = "column";
                editor.style.display = "block"; editor.style.flex = "1";
                content.style.display = "none"; divider.style.display = "none"; splitPreview.style.display = "none";
                break;
            case "preview":
                toolbar.style.display = "none"; editorArea.style.flexDirection = "column";
                editor.style.display = "none"; content.style.display = "block"; content.style.flex = "1";
                divider.style.display = "none"; splitPreview.style.display = "none";
                break;
            case "split":
                toolbar.style.display = "flex"; editorArea.style.flexDirection = "row";
                editor.style.display = "block"; editor.style.flex = "1";
                content.style.display = "none"; divider.style.display = "block";
                splitPreview.style.display = "block"; splitPreview.style.flex = "1";
                MoCang.updateSplitPreview();
                break;
        }
        updateToolbarState();
    }

    function updateToolbarState() {
        const hasFile = !!MoCang.activeFileId;
        document.querySelectorAll(".kb-tool-btn").forEach(btn => {
            if (btn.dataset.action && btn.dataset.action !== "save") {
                btn.style.opacity = hasFile ? "" : "0.3";
                btn.style.pointerEvents = hasFile ? "" : "none";
            }
        });
        const saveBtn = document.querySelector(".kb-save-btn");
        if (saveBtn) {
            saveBtn.style.opacity = hasFile ? "" : "0.3";
            saveBtn.style.pointerEvents = hasFile ? "" : "none";
        }
        document.querySelectorAll(".kb-view-btn").forEach(btn => {
            if (btn.dataset.mode === "split" || btn.dataset.mode === "edit") {
                btn.style.opacity = hasFile ? "" : "0.3";
                btn.style.pointerEvents = hasFile ? "" : "none";
            }
        });
    }

    // ── 目录导航 ──
    function renderToc(headings) {
        const tocList = document.getElementById("kb-toc-list");
        tocList.innerHTML = "";
        headings.forEach(h => {
            const item = document.createElement("a");
            item.className = "kb-toc-item level-" + h.level;
            item.textContent = h.text;
            item.title = h.text;
            item.addEventListener("click", () => {
                const els = document.getElementById("kb-content").querySelectorAll("h1,h2,h3,h4,h5,h6");
                for (const el of els) {
                    if (el.textContent.trim() === h.text) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                        el.style.transition = "background 0.3s";
                        el.style.background = "rgba(108,99,255,0.15)";
                        setTimeout(() => el.style.background = "transparent", 1500);
                        break;
                    }
                }
            });
            tocList.appendChild(item);
        });
    }

    // ── 暴露到 MoCang 命名空间 ──
    MoCang.setViewMode = setViewMode;
    MoCang.applyViewMode = applyViewMode;
    MoCang.updateToolbarState = updateToolbarState;
    MoCang.renderToc = renderToc;

})();
