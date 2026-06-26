/* ═══════════════════════════════════════════════
   api.js - API 工具函数
   ═══════════════════════════════════════════════ */

async function apiJson(url, opts = {}) {
    const defaults = { headers: { "Content-Type": "application/json" } };
    const resp = await fetch(url, { ...defaults, ...opts });
    return resp.json();
}
