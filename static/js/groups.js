/* ═══════════════════════════════════════════════
   groups.js - 分组管理与拖放
   ═══════════════════════════════════════════════ */

(function() {

    // ── 全局拖拽事件：显示/隐藏顶底拖放区 ──
    document.addEventListener("dragstart", (e) => {
        if (e.dataTransfer.types.includes("text/group")) {
            document.querySelectorAll(".kb-delete-zone, .kb-root-drop-zone").forEach(el => el.classList.add("active"));
        }
    });
    document.addEventListener("dragend", () => {
        hideAllDropZones();
        clearHoverExpand();
        stopEdgeScroll();
    });
    document.addEventListener("drop", () => {
        hideAllDropZones();
        clearHoverExpand();
        stopEdgeScroll();
    });

    function hideAllDropZones() {
        document.querySelectorAll(".kb-delete-zone, .kb-root-drop-zone").forEach(el => {
            el.classList.remove("active");
            el.classList.remove("drag-over");
        });
        removeDragIndicator();
    }

    // ── 拖拽排序指示线 ──
    function showDragIndicator(groupEl, position) {
        removeDragIndicator();
        const indicator = document.createElement("div");
        indicator.className = "drag-indicator";
        const parent = groupEl.parentElement;
        if (!parent) return;
        parent.style.position = "relative";
        if (position === "before") {
            // 指示线在该分组上方（与上一个分组之间的间隙）
            const top = groupEl.offsetTop;
            indicator.style.top = (top - 1) + "px";
        } else {
            // 指示线在该分组下方（与下一个分组之间的间隙）
            const top = groupEl.offsetTop + groupEl.offsetHeight;
            indicator.style.top = (top - 1) + "px";
        }
        parent.appendChild(indicator);
    }

    function removeDragIndicator() {
        document.querySelectorAll(".drag-indicator").forEach(el => el.remove());
    }

    // ── 悬停自动展开（拖拽到折叠分组上 500ms 后自动展开）──
    var hoverExpandTimer = null;
    var hoverExpandTarget = null;

    function setupHoverExpand(groupName, groupEl) {
        if (hoverExpandTarget === groupName) return;
        clearHoverExpand();
        if (MoCang.collapsedGroups.has(groupName)) {
            hoverExpandTarget = groupName;
            hoverExpandTimer = setTimeout(() => {
                MoCang.collapsedGroups.delete(groupName);
                MoCang.renderFileList();
                hoverExpandTarget = null;
            }, 500);
        }
    }

    function clearHoverExpand() {
        if (hoverExpandTimer) { clearTimeout(hoverExpandTimer); hoverExpandTimer = null; }
        hoverExpandTarget = null;
    }

    // ── 边缘自动滚动 ──
    var edgeScrollTimer = null;

    function setupEdgeScroll(e) {
        const sidebar = document.getElementById("kb-sidebar");
        if (!sidebar) return;
        const rect = sidebar.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const EDGE = 40;
        const SPEED = 10;

        if (y < EDGE) {
            if (!edgeScrollTimer) {
                edgeScrollTimer = setInterval(() => { sidebar.scrollTop -= SPEED; }, 30);
            }
        } else if (y > rect.height - EDGE) {
            if (!edgeScrollTimer) {
                edgeScrollTimer = setInterval(() => { sidebar.scrollTop += SPEED; }, 30);
            }
        } else {
            stopEdgeScroll();
        }
    }

    function stopEdgeScroll() {
        if (edgeScrollTimer) { clearInterval(edgeScrollTimer); edgeScrollTimer = null; }
    }

    function buildGroupTree(fileList) {
        const root = { name: "__root__", files: [], children: [] };
        const ungroupedNode = { name: "__ungrouped__", files: [], children: [], displayName: "未分组" };
        const groupMap = { "": ungroupedNode };

        // 收集文件到分组
        fileList.forEach(f => {
            const g = f.group || "";
            if (!groupMap[g]) groupMap[g] = { name: g, files: [], children: [] };
            groupMap[g].files.push(f);
        });

        // 补充空分组
        MoCang.groups.forEach(g => {
            if (!groupMap[g]) groupMap[g] = { name: g, files: [], children: [] };
        });

        // 建立父子关系
        Object.keys(groupMap).forEach(g => {
            if (g === "") return;
            const lastSlash = g.lastIndexOf("/");
            const parent = lastSlash >= 0 ? g.substring(0, lastSlash) : "";
            if (parent === "") {
                root.children.push(groupMap[g]);
            } else if (groupMap[parent]) {
                groupMap[parent].children.push(groupMap[g]);
            } else {
                root.children.push(groupMap[g]);
            }
        });

        // 按 groups 数组排序根级子分组
        root.children.sort((a, b) => {
            const ia = MoCang.groups.indexOf(a.name);
            const ib = MoCang.groups.indexOf(b.name);
            return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
        });

        // 在精确位置插入 "未分组"
        const idx = typeof MoCang.ungroupedPosition === "number" ? MoCang.ungroupedPosition : 0;
        const insertAt = Math.max(0, Math.min(idx, root.children.length));
        root.children.splice(insertAt, 0, ungroupedNode);

        return root;
    }

    function renderGroupNode(container, node, depth) {
        const child = node;
        const isUngrouped = child.name === "__ungrouped__";
        const isCollapsed = MoCang.collapsedGroups.has(child.name);

        const groupEl = document.createElement("div");
        groupEl.className = "kb-group";
        groupEl.dataset.group = child.name;

        const header = document.createElement("div");
        header.className = "kb-group-header";
        header.style.paddingLeft = (8 + Math.min(depth, 3) * 16) + "px";
        header.draggable = true;
        const displayName = child.displayName || child.name.split("/").pop();
        header.innerHTML = '<span class="kb-group-arrow">' + (isCollapsed ? "▶" : "▼") + '</span> ' + displayName + ' <span class="kb-group-count">(' + countGroupFiles(child) + ')</span>';

        // 折叠/展开
        header.addEventListener("click", () => {
            if (MoCang.collapsedGroups.has(child.name)) MoCang.collapsedGroups.delete(child.name);
            else MoCang.collapsedGroups.add(child.name);
            MoCang.renderFileList();
        });

        // 拖拽开始
        header.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/group", child.name);
            e.dataTransfer.effectAllowed = "move";
            groupEl.classList.add("dragging");
        });
        header.addEventListener("dragend", () => groupEl.classList.remove("dragging"));

        // 拖入目标
        if (isUngrouped) {
            // "未分组"只接受文件（取消分组），不接受分组嵌套
            header.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (e.dataTransfer.types.includes("text/plain")) header.classList.add("drag-over");
            });
            header.addEventListener("dragleave", () => header.classList.remove("drag-over"));
            header.addEventListener("drop", (e) => {
                e.preventDefault();
                e.stopPropagation();
                header.classList.remove("drag-over");
                const fileId = e.dataTransfer.getData("text/plain");
                if (fileId) {
                    const file = MoCang.files.find(ff => ff.id === fileId);
                    if (file) updateFileGroup(file, "");
                }
                hideAllDropZones();
            });
        } else {
            // 普通分组：接受文件（移入分组）和分组（嵌套或排序）
            header.addEventListener("dragover", (e) => {
                e.preventDefault();
                const isGroupDrag = e.dataTransfer.types.includes("text/group");
                const isFileDrag = e.dataTransfer.types.includes("text/plain");
                header.classList.remove("drag-over");

                if (isGroupDrag) {
                    const rect = header.getBoundingClientRect();
                    const ratio = (e.clientY - rect.top) / rect.height;
                    if (ratio < 0.2) {
                        showDragIndicator(groupEl, "before");
                    } else if (ratio > 0.8) {
                        showDragIndicator(groupEl, "after");
                    } else {
                        removeDragIndicator();
                        header.classList.add("drag-over");
                    }
                    setupHoverExpand(child.name, groupEl);
                } else if (isFileDrag) {
                    header.classList.add("drag-over");
                    setupHoverExpand(child.name, groupEl);
                }
                setupEdgeScroll(e);
            });
            header.addEventListener("dragleave", () => {
                header.classList.remove("drag-over");
            });
            header.addEventListener("drop", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = header.getBoundingClientRect();
                const ratio = (e.clientY - rect.top) / rect.height;
                header.classList.remove("drag-over");
                removeDragIndicator();

                const fileId = e.dataTransfer.getData("text/plain");
                const dragGroupName = e.dataTransfer.getData("text/group");

                if (fileId) {
                    const file = MoCang.files.find(ff => ff.id === fileId);
                    if (file) updateFileGroup(file, child.name);
                } else if (dragGroupName && dragGroupName !== child.name) {
                    if (child.name.startsWith(dragGroupName + "/")) return;
                    if (ratio < 0.2) {
                        reorderGroup(dragGroupName, child.name, "before");
                    } else if (ratio > 0.8) {
                        reorderGroup(dragGroupName, child.name, "after");
                    } else {
                        moveGroup(dragGroupName, child.name);
                    }
                }
                hideAllDropZones();
            });
        }

        groupEl.appendChild(header);

        if (!isCollapsed) {
            // 渲染该分组下的文件
            child.files.forEach(f => groupEl.appendChild(MoCang.createFileItem(f)));
            // 渲染子分组
            if (child.children.length > 0) {
                const childrenEl = document.createElement("div");
                childrenEl.className = "kb-group-children";
                child.children.forEach(c => renderGroupNode(childrenEl, c, depth + 1));
                groupEl.appendChild(childrenEl);
            }
        }

        container.appendChild(groupEl);
    }

    function countGroupFiles(node) {
        let count = node.files.length;
        node.children.forEach(c => count += countGroupFiles(c));
        return count;
    }

    function reorderGroup(dragName, targetName, position) {
        const dragParent = getParentGroupName(dragName);
        const targetParent = getParentGroupName(targetName);

        // 如果父级不同，在拖拽项的父级内移到最前或最后
        if (dragParent !== targetParent) {
            const dragSiblings = getDisplayOrder(dragParent);
            const filtered = dragSiblings.filter(g => g !== dragName);
            if (position === "before") {
                filtered.unshift(dragName);
            } else {
                filtered.push(dragName);
            }
            saveDisplayOrder(dragParent, filtered);
            MoCang.renderFileList();
            return;
        }

        // 同父级：用 filter 重建顺序，避免 splice 索引计算问题
        const siblings = getDisplayOrder(dragParent);
        const withoutDrag = siblings.filter(g => g !== dragName);
        const targetIdx = withoutDrag.indexOf(targetName);
        if (targetIdx === -1) return;

        if (position === "before") {
            withoutDrag.splice(targetIdx, 0, dragName);
        } else {
            withoutDrag.splice(targetIdx + 1, 0, dragName);
        }

        saveDisplayOrder(dragParent, withoutDrag);
        MoCang.renderFileList();
    }

    function getDisplayOrder(parentName) {
        // 获取某个父级下的直接子分组的显示顺序（含 "未分组"）
        const prefix = parentName ? parentName + "/" : "";
        const siblings = MoCang.groups.filter(g => g.startsWith(prefix) && !g.substring(prefix.length).includes("/"));
        if (parentName === "") {
            // 按 ungroupedPosition 数字索引插入
            const idx = typeof MoCang.ungroupedPosition === "number" ? MoCang.ungroupedPosition : 0;
            const list = [...siblings];
            list.splice(Math.max(0, Math.min(idx, list.length)), 0, "__ungrouped__");
            return list;
        }
        return siblings;
    }

    function saveDisplayOrder(parentName, orderedList) {
        if (parentName === "") {
            // 根级：提取 groups 和 ungroupedPosition
            const ungroupedIdx = orderedList.indexOf("__ungrouped__");
            const withoutUngrouped = orderedList.filter(g => g !== "__ungrouped__");
            MoCang.groups = withoutUngrouped;
            MoCang.ungroupedPosition = ungroupedIdx >= 0 ? ungroupedIdx : 0;
        } else {
            // 非根级：更新 groups 中的子分组顺序
            const prefix = parentName + "/";
            const others = MoCang.groups.filter(g => !g.startsWith(prefix) || g.substring(prefix.length).includes("/"));
            MoCang.groups = [...others, ...orderedList];
        }
        // 同步保存（不等待结果，但确保本地状态已更新）
        apiJson("/api/groups", { method: "POST", body: JSON.stringify({ groups: MoCang.groups }) });
        apiJson("/api/settings", { method: "POST", body: JSON.stringify({ ungrouped_position: MoCang.ungroupedPosition }) });
    }

    function getParentGroupName(g) {
        const i = g.lastIndexOf("/");
        return i >= 0 ? g.substring(0, i) : "";
    }

    function moveGroup(fromGroup, toParent) {
        const baseName = fromGroup.split("/").pop();
        const newName = toParent + "/" + baseName;
        if (newName.startsWith(fromGroup + "/") || newName === fromGroup) return;

        MoCang.files.forEach(f => {
            if (f.group === fromGroup || f.group.startsWith(fromGroup + "/")) {
                const suffix = f.group.substring(fromGroup.length);
                f.group = newName + suffix;
                apiJson("/api/files/" + f.id, { method: "PATCH", body: JSON.stringify({ group: f.group }) });
            }
        });

        const affectedOld = MoCang.groups.filter(g => g === fromGroup || g.startsWith(fromGroup + "/"));
        MoCang.groups = MoCang.groups.filter(g => g !== fromGroup && !g.startsWith(fromGroup + "/"));
        affectedOld.forEach(g => {
            const suffix = g.substring(fromGroup.length);
            const newG = newName + suffix;
            if (!MoCang.groups.includes(newG)) MoCang.groups.push(newG);
        });

        apiJson("/api/groups", { method: "POST", body: JSON.stringify({ groups: MoCang.groups }) });
        MoCang.renderFileList();
    }

    function moveGroupToRoot(groupName) {
        const baseName = groupName.split("/").pop();
        // 如果已经在根级，不处理
        if (!groupName.includes("/")) return;

        MoCang.files.forEach(f => {
            if (f.group === groupName || f.group.startsWith(groupName + "/")) {
                const suffix = f.group.substring(groupName.length);
                f.group = baseName + suffix;
                apiJson("/api/files/" + f.id, { method: "PATCH", body: JSON.stringify({ group: f.group }) });
            }
        });

        const affectedOld = MoCang.groups.filter(g => g === groupName || g.startsWith(groupName + "/"));
        MoCang.groups = MoCang.groups.filter(g => g !== groupName && !g.startsWith(groupName + "/"));
        affectedOld.forEach(g => {
            const suffix = g.substring(groupName.length);
            const newG = baseName + suffix;
            if (!MoCang.groups.includes(newG)) MoCang.groups.push(newG);
        });

        apiJson("/api/groups", { method: "POST", body: JSON.stringify({ groups: MoCang.groups }) });
        MoCang.renderFileList();
    }

    function deleteGroup(groupName) {
        if (groupName === "__ungrouped__") return; // "未分组"不可删除
        MoCang.files.forEach(f => {
            if (f.group === groupName || f.group.startsWith(groupName + "/")) {
                f.group = "";
                apiJson("/api/files/" + f.id, { method: "PATCH", body: JSON.stringify({ group: "" }) });
            }
        });
        MoCang.groups = MoCang.groups.filter(g => g !== groupName && !g.startsWith(groupName + "/"));
        apiJson("/api/groups/" + encodeURIComponent(groupName), { method: "DELETE" });
        apiJson("/api/groups", { method: "POST", body: JSON.stringify({ groups: MoCang.groups }) });
        MoCang.renderFileList();
    }

    // ── 分组选择器 ──
    function showGroupSelector(file, anchorEl) {
        const existing = document.querySelector(".group-selector-popup");
        if (existing) existing.remove();

        const allGroups = [...new Set([...MoCang.files.map(f => f.group).filter(Boolean), ...MoCang.groups])].sort();

        const popup = document.createElement("div");
        popup.className = "group-selector-popup";
        popup.innerHTML = '<div class="group-selector-title">选择分组</div>';

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "输入新分组名...";
        input.value = file.group || "";
        input.className = "group-selector-input";
        popup.appendChild(input);

        const noneItem = document.createElement("div");
        noneItem.className = "group-selector-item";
        noneItem.textContent = "清除分组";
        noneItem.addEventListener("click", () => {
            updateFileGroup(file, "");
            popup.remove();
        });
        popup.appendChild(noneItem);

        allGroups.forEach(g => {
            const gItem = document.createElement("div");
            gItem.className = "group-selector-item";
            gItem.textContent = g;
            gItem.addEventListener("click", () => {
                updateFileGroup(file, g);
                popup.remove();
            });
            popup.appendChild(gItem);
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                updateFileGroup(file, input.value.trim());
                popup.remove();
            }
        });

        const rect = anchorEl.getBoundingClientRect();
        popup.style.top = rect.bottom + 4 + "px";
        popup.style.left = rect.left + "px";
        document.body.appendChild(popup);

        input.focus();
        setTimeout(() => {
            document.addEventListener("click", function handler(e) {
                if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener("click", handler); }
            });
        }, 0);
    }

    function updateFileGroup(file, group) {
        file.group = group;
        apiJson("/api/files/" + file.id, {
            method: "PATCH",
            body: JSON.stringify({ group }),
        });
        MoCang.renderFileList();
    }

    function setupDeleteZone() {
        const zone = document.getElementById("kb-delete-zone");
        if (!zone) return;
        zone.innerHTML = '<img src="/static/icons/svgs/shanchu.svg" width="14" height="14" style="vertical-align:middle;filter:invert(1) brightness(0.8);"> 拖放至此删除分组';
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes("text/group")) zone.classList.add("drag-over");
        });
        zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.classList.remove("drag-over");
            zone.classList.remove("active");
            const groupName = e.dataTransfer.getData("text/group");
            if (groupName) deleteGroup(groupName);
        });
    }

    // ── 暴露到 MoCang 命名空间 ──
    MoCang.buildGroupTree = buildGroupTree;
    MoCang.renderGroupNode = renderGroupNode;
    MoCang.countGroupFiles = countGroupFiles;
    MoCang.reorderGroup = reorderGroup;
    MoCang.getDisplayOrder = getDisplayOrder;
    MoCang.saveDisplayOrder = saveDisplayOrder;
    MoCang.getParentGroupName = getParentGroupName;
    MoCang.moveGroup = moveGroup;
    MoCang.moveGroupToRoot = moveGroupToRoot;
    MoCang.deleteGroup = deleteGroup;
    MoCang.showGroupSelector = showGroupSelector;
    MoCang.updateFileGroup = updateFileGroup;
    MoCang.setupDeleteZone = setupDeleteZone;
    MoCang.hideAllDropZones = hideAllDropZones;
    MoCang.setupEdgeScroll = setupEdgeScroll;
    MoCang.stopEdgeScroll = stopEdgeScroll;

})();
