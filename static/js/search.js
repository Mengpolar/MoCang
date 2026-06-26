/* ═══════════════════════════════════════════════
   search.js - 全局搜索
   ═══════════════════════════════════════════════ */

(function() {

    // ── 搜索 ──
    async function search(query) {
        const el = document.getElementById("search-results");
        if (!query || !query.trim()) { el.style.display = "none"; return; }
        try {
            const results = await apiJson("/api/search?q=" + encodeURIComponent(query.trim()));
            if (results.length === 0) { el.innerHTML = '<div class="sr-empty">无匹配结果</div>'; el.style.display = "block"; return; }
            el.innerHTML = "";
            results.forEach(g => {
                const gEl = document.createElement("div"); gEl.className = "sr-group";
                const title = document.createElement("div"); title.className = "sr-group-title";
                title.textContent = g.alias + " (" + g.total + "处匹配)";
                title.addEventListener("click", () => { closeSearchResults(); MoCang.openFile(g.id); });
                gEl.appendChild(title);
                g.matches.forEach(m => {
                    const mEl = document.createElement("div"); mEl.className = "sr-match";
                    const ln = document.createElement("span"); ln.className = "sr-match-line"; ln.textContent = "L" + m.line;
                    const txt = document.createElement("span");
                    const esc = escapeHtml(m.text);
                    txt.innerHTML = esc.replace(new RegExp(escapeRegex(query.trim()), "gi"), match => '<mark>' + match + '</mark>');
                    mEl.appendChild(ln); mEl.appendChild(txt);
                    mEl.addEventListener("click", () => { closeSearchResults(); MoCang.openFile(g.id); });
                    gEl.appendChild(mEl);
                });
                el.appendChild(gEl);
            });
            el.style.display = "block";
        } catch {}
    }

    function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
    function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function closeSearchResults() { document.getElementById("search-results").style.display = "none"; document.getElementById("global-search").value = ""; }

    // ── 暴露到 MoCang 命名空间 ──
    MoCang.search = search;
    MoCang.escapeHtml = escapeHtml;
    MoCang.escapeRegex = escapeRegex;
    MoCang.closeSearchResults = closeSearchResults;

})();
