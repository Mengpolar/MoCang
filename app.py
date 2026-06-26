"""墨仓 | MoCang - Markdown 知识库管理器 (桌面版)"""
import json
import os
import sys
import uuid
import re
import threading
import markdown
from pathlib import Path
from flask import Flask, render_template, request, jsonify

# ── 路径兼容 ──────────────────────────────────────────────────

def get_base_dir():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent

BASE_DIR = get_base_dir()
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
KNOWLEDGE_FILE = DATA_DIR / "knowledge.json"
SETTINGS_FILE = DATA_DIR / "settings.json"
GROUPS_FILE = DATA_DIR / "groups.json"

# ── Flask 应用 ────────────────────────────────────────────────

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
app.secret_key = os.urandom(32).hex()

# ── 工具函数 ──────────────────────────────────────────────────

def load_json(path, default=None):
    if default is None:
        default = []
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                content = f.read().strip()
                if not content:
                    return default
                return json.loads(content)
        except (json.JSONDecodeError, Exception):
            return default
    return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ── 页面路由 ──────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/background")
def api_get_background():
    """返回背景图片"""
    settings = load_settings()
    bg_path = settings.get("interface", {}).get("background_image", "")
    if bg_path and os.path.isfile(bg_path):
        from flask import send_file
        return send_file(bg_path)
    return "", 404

# ── 知识库 API ───────────────────────────────────────────────

@app.route("/api/files", methods=["GET"])
def api_get_files():
    return jsonify(load_json(KNOWLEDGE_FILE, []))

@app.route("/api/files", methods=["POST"])
def api_add_file():
    data = request.get_json(silent=True) or {}
    file_path = data.get("path", "").strip()
    alias = data.get("alias", "").strip()
    if not file_path:
        return jsonify({"error": "路径不能为空"}), 400
    if not os.path.isfile(file_path):
        return jsonify({"error": "文件不存在"}), 400
    if not file_path.lower().endswith(".md"):
        return jsonify({"error": "仅支持 .md 文件"}), 400
    files = load_json(KNOWLEDGE_FILE, [])
    entry = {
        "id": uuid.uuid4().hex[:8],
        "path": file_path,
        "alias": alias or Path(file_path).stem,
        "group": "",
    }
    files.append(entry)
    save_json(KNOWLEDGE_FILE, files)
    return jsonify(entry), 201

@app.route("/api/files/<file_id>", methods=["DELETE"])
def api_delete_file(file_id):
    files = load_json(KNOWLEDGE_FILE, [])
    files = [f for f in files if f["id"] != file_id]
    save_json(KNOWLEDGE_FILE, files)
    return jsonify({"ok": True})

@app.route("/api/files/<file_id>", methods=["PATCH"])
def api_update_file(file_id):
    data = request.get_json(silent=True) or {}
    files = load_json(KNOWLEDGE_FILE, [])
    for f in files:
        if f["id"] == file_id:
            if "alias" in data:
                f["alias"] = data["alias"].strip() or f["alias"]
            if "group" in data:
                f["group"] = data["group"]
            save_json(KNOWLEDGE_FILE, files)
            return jsonify(f)
    return jsonify({"error": "未找到"}), 404

# ── 分组 API ─────────────────────────────────────────────────

@app.route("/api/groups", methods=["GET"])
def api_get_groups():
    return jsonify(load_json(GROUPS_FILE, []))

@app.route("/api/groups", methods=["POST"])
def api_add_group():
    data = request.get_json(silent=True) or {}
    # 批量更新分组列表
    if "groups" in data:
        # 过滤掉所有内部标识符和 sentinel
        clean = [g for g in data["groups"] if g and not g.startswith(":") and g not in ("__ungrouped__", "__root__")]
        save_json(GROUPS_FILE, clean)
        return jsonify({"ok": True, "groups": clean})
    # 添加单个分组
    name = data.get("name", "").strip()
    if not name or name in ("__ungrouped__", "__root__"):
        return jsonify({"error": "名称不能为空"}), 400
    groups = load_json(GROUPS_FILE, [])
    if name in groups:
        return jsonify({"error": "分组已存在"}), 400
    groups.append(name)
    save_json(GROUPS_FILE, groups)
    return jsonify({"ok": True, "groups": groups})

@app.route("/api/groups/<path:name>", methods=["DELETE"])
def api_delete_group(name):
    # 将该分组及其子分组下的文件移至未分组
    files = load_json(KNOWLEDGE_FILE, [])
    changed = False
    for f in files:
        if f.get("group") == name or f.get("group", "").startswith(name + "/"):
            f["group"] = ""
            changed = True
    if changed:
        save_json(KNOWLEDGE_FILE, files)
    # 从分组列表中删除
    groups = load_json(GROUPS_FILE, [])
    groups = [g for g in groups if g != name and not g.startswith(name + "/")]
    save_json(GROUPS_FILE, groups)
    return jsonify({"ok": True, "groups": groups})

@app.route("/api/content/<file_id>", methods=["GET"])
def api_get_content(file_id):
    files = load_json(KNOWLEDGE_FILE, [])
    entry = next((f for f in files if f["id"] == file_id), None)
    if not entry:
        return jsonify({"error": "未找到"}), 404
    path = entry["path"]
    if not os.path.isfile(path):
        return jsonify({"error": "文件已不存在: " + path}), 404
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    headings = []
    for m in re.finditer(r"^(#{1,6})\s+(.+)$", raw, re.MULTILINE):
        level = len(m.group(1))
        text = m.group(2).strip()
        anchor = re.sub(r"[^\w一-鿿-]", "", text.replace(" ", "-")).lower()
        headings.append({"level": level, "text": text, "anchor": anchor})
    html = markdown.markdown(
        raw,
        extensions=["fenced_code", "tables", "toc", "codehilite"],
        extension_configs={
            "codehilite": {"css_class": "highlight", "linenums": False},
            "toc": {"permalink": False},
        },
    )
    return jsonify({"html": html, "headings": headings, "raw": raw})

@app.route("/api/save/<file_id>", methods=["POST"])
def api_save_file(file_id):
    files = load_json(KNOWLEDGE_FILE, [])
    entry = next((f for f in files if f["id"] == file_id), None)
    if not entry:
        return jsonify({"error": "未找到"}), 404
    path = entry["path"]
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/search", methods=["GET"])
def api_search():
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify([])
    files = load_json(KNOWLEDGE_FILE, [])
    results = []
    for entry in files:
        path = entry["path"]
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                raw = f.read()
        except Exception:
            continue
        matches = []
        for i, line in enumerate(raw.split("\n"), 1):
            if query in line.lower():
                matches.append({"line": i, "text": line.strip()})
        if matches:
            results.append({
                "id": entry["id"],
                "alias": entry["alias"],
                "path": entry["path"],
                "matches": matches[:10],
                "total": len(matches),
            })
    return jsonify(results)

# ── 设置 API ─────────────────────────────────────────────────

DEFAULT_SETTINGS = {
    "window": {"width": 1280, "height": 800, "x": None, "y": None, "maximized": False},
    "active_file_id": None,
    "view_mode": "preview",
    "lock": {
        "enabled": False,
        "password": "",
        "idle_timeout": 0,
    },
    "editor": {
        "auto_save": True,
        "save_interval": 60,
        "font_size": 14,
    },
    "interface": {
        "background_image": "",
        "dark_mode": True,
        "opacity": 1.0,
        "ui_opacity": 0.9,
        "bg_blur": 0,
    },
    "software": {
        "auto_update": False,
        "show_resource": False,
    },
}

def load_settings():
    s = load_json(SETTINGS_FILE, None)
    if s:
        # 合并默认值（兼容旧版本配置）
        for k, v in DEFAULT_SETTINGS.items():
            if k not in s:
                s[k] = v
            elif isinstance(v, dict):
                for kk, vv in v.items():
                    if kk not in s[k]:
                        s[k][kk] = vv
        return s
    return dict(DEFAULT_SETTINGS)

def save_settings(data):
    save_json(SETTINGS_FILE, data)

@app.route("/api/settings", methods=["GET"])
def api_get_settings():
    return jsonify(load_settings())

@app.route("/api/settings", methods=["POST"])
def api_save_settings():
    data = request.get_json(silent=True) or {}
    current = load_settings()
    # 深度合并
    for k, v in data.items():
        if isinstance(v, dict) and k in current and isinstance(current[k], dict):
            current[k].update(v)
        else:
            current[k] = v
    save_settings(current)
    return jsonify({"ok": True})

@app.route("/api/settings/verify-lock", methods=["POST"])
def api_verify_lock():
    """验证锁屏密码"""
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    settings = load_settings()
    stored = settings.get("lock", {}).get("password", "")
    if not stored:
        return jsonify({"ok": True, "msg": "未设置密码"})
    if password == stored:
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "密码错误"}), 401

@app.route("/api/settings/upload-bg", methods=["POST"])
def api_upload_bg():
    """上传背景图片"""
    if "file" not in request.files:
        return jsonify({"error": "未选择文件"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "未选择文件"}), 400
    ext = Path(f.filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"):
        return jsonify({"error": "不支持的图片格式"}), 400
    bg_dir = DATA_DIR / "backgrounds"
    bg_dir.mkdir(exist_ok=True)
    filename = f"bg{ext}"
    save_path = bg_dir / filename
    f.save(str(save_path))
    settings = load_settings()
    settings["interface"]["background_image"] = str(save_path)
    save_settings(settings)
    return jsonify({"ok": True, "path": str(save_path)})

@app.route("/api/settings/remove-bg", methods=["POST"])
def api_remove_bg():
    """移除背景图片"""
    settings = load_settings()
    bg_path = settings.get("interface", {}).get("background_image", "")
    if bg_path and os.path.isfile(bg_path):
        try:
            os.remove(bg_path)
        except Exception:
            pass
    settings["interface"]["background_image"] = ""
    save_settings(settings)
    return jsonify({"ok": True})

# ── pywebview 窗口控制 API ───────────────────────────────────

class WindowApi:
    """暴露给 JS 的窗口控制方法"""
    def __init__(self):
        self._window = None
        self._maximized = False
        self._locked = False

    def set_window(self, window):
        self._window = window

    def minimize(self):
        if self._window:
            self._window.minimize()

    def toggle_maximize(self):
        if self._window:
            if self._maximized:
                self._window.restore()
                self._maximized = False
            else:
                self._window.maximize()
                self._maximized = True

    def is_maximized(self):
        return self._maximized

    def resize(self, width, height):
        if self._window:
            try:
                self._window.resize(int(width), int(height))
            except Exception:
                pass
        return True

    def move(self, x, y):
        if self._window:
            try:
                self._window.move(int(x), int(y))
            except Exception:
                pass
        return True

    def move_and_resize(self, x, y, width, height):
        """同时移动和缩放窗口（用于左/上边缘缩放）"""
        if not self._window:
            return True
        try:
            self._window.move(int(x), int(y))
            self._window.resize(int(width), int(height))
        except Exception:
            pass
        return True

    def resize_only(self, width, height):
        """仅缩放窗口，不改变位置（用于右/下边缘缩放）"""
        if not self._window:
            return True
        try:
            self._window.resize(int(width), int(height))
        except Exception:
            pass
        return True

    def _get_hwnd(self):
        """获取窗口句柄（.NET IntPtr → Python int）"""
        try:
            return self._window.native.Handle.ToInt64()
        except Exception:
            return None

    def set_window_opacity(self, opacity):
        """设置窗口整体透明度（0.0~1.0），使用 Win32 API"""
        hwnd = self._get_hwnd()
        if not hwnd:
            return True
        try:
            import ctypes
            GWL_EXSTYLE = -20
            WS_EX_LAYERED = 0x00080000
            style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED)
            alpha = max(0, min(255, int(opacity * 255)))
            LWA_ALPHA = 0x02
            ctypes.windll.user32.SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)
        except Exception:
            pass
        return True

    def get_position(self):
        if self._window:
            try:
                pos = self._window.position
                if pos and pos[0] is not None and pos[1] is not None:
                    return {"x": int(pos[0]), "y": int(pos[1])}
            except Exception:
                pass
        return {"x": 0, "y": 0}

    def get_size(self):
        if self._window:
            try:
                size = self._window.size
                if size and size[0] is not None and size[1] is not None:
                    return {"width": int(size[0]), "height": int(size[1])}
            except Exception:
                pass
        return {"width": 1280, "height": 800}

    def save_state(self):
        """保存当前窗口状态（JS 端也会通过 beforeunload 保存）"""
        settings = load_settings()
        settings["window"]["maximized"] = self._maximized
        save_settings(settings)

    def set_locked(self, locked):
        self._locked = locked
        return True

    def close(self):
        self.save_state()
        if self._window:
            self._window.destroy()

    def get_resource_usage(self):
        """获取当前进程的 CPU 和内存占用"""
        try:
            import psutil
            p = psutil.Process()
            cpu = p.cpu_percent(interval=0)
            mem = p.memory_info().rss / (1024 * 1024)  # MB
            return {"cpu": round(cpu, 1), "mem": round(mem, 1)}
        except ImportError:
            # psutil 未安装时用 os 模块获取内存
            try:
                import resource
                mem = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
                return {"cpu": 0, "mem": round(mem, 1)}
            except:
                return {"cpu": 0, "mem": 0}
        except:
            return {"cpu": 0, "mem": 0}

    def open_file_dialog(self):
        """打开文件选择对话框，返回选中的 .md 文件路径列表"""
        if not self._window:
            return []
        try:
            result = self._window.create_file_dialog(
                file_types=('Markdown 文件 (*.md)',),
                allow_multiple=True,
            )
            if result:
                return [str(p) for p in result]
        except Exception as e:
            print(f"[ERROR] open_file_dialog: {e}")
        return []

window_api = WindowApi()

# ── 启动 ─────────────────────────────────────────────────────

FLASK_PORT = 50123

def start_flask():
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    app.run(host="127.0.0.1", port=FLASK_PORT, debug=False, use_reloader=False)

def main():
    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()

    import time, urllib.request
    url = f"http://127.0.0.1:{FLASK_PORT}"
    for _ in range(30):
        try:
            urllib.request.urlopen(url, timeout=1)
            break
        except Exception:
            time.sleep(0.1)

    # 恢复上次窗口状态
    settings = load_settings()
    win = settings.get("window", {})
    w = win.get("width", 1280)
    h = win.get("height", 800)
    x = win.get("x")
    y = win.get("y")

    import webview
    window = webview.create_window(
        title="墨仓 | MoCang",
        url=url,
        width=w,
        height=h,
        x=x,
        y=y,
        min_size=(900, 600),
        frameless=True,
        easy_drag=False,
        text_select=True,
        js_api=window_api,
        background_color="#0a0a0f",
    )
    window_api.set_window(window)
    window_api._maximized = win.get("maximized", False)

    # 窗口关闭时保存状态
    def on_closing():
        settings = load_settings()
        settings["window"]["maximized"] = window_api._maximized
        # 如果锁屏处于显示状态，标记需要强制锁屏
        settings["lock"]["force_lock"] = window_api._locked
        save_settings(settings)
    window.events.closing += on_closing

    # 启动后恢复最大化状态
    if window_api._maximized:
        window.maximize()

    webview.start(gui="edgechromium")
    os._exit(0)

if __name__ == "__main__":
    if "--web" in sys.argv:
        print(f"[OK] 墨仓 | MoCang 启动中（浏览器模式）...")
        print(f"[OK] 访问地址: http://localhost:{FLASK_PORT}")
        app.run(host="0.0.0.0", port=FLASK_PORT, debug=True)
    else:
        main()
