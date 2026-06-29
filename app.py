"""墨仓 | MoCang - Markdown 知识库管理器 (桌面版)"""
import os
import sys
import threading
from flask import Flask, render_template

from utils import BASE_DIR, DATA_DIR, load_settings, save_settings, get_secret_key

# ── Flask 应用 ────────────────────────────────────────────────

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
app.secret_key = get_secret_key()

# ── 安全响应头 ────────────────────────────────────────────────

@app.after_request
def set_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ── 注册蓝图 ─────────────────────────────────────────────────

from routes.files import files_bp
from routes.groups import groups_bp
from routes.settings import settings_bp
from routes.ai import ai_bp

app.register_blueprint(files_bp, url_prefix="/api")
app.register_blueprint(groups_bp, url_prefix="/api")
app.register_blueprint(settings_bp, url_prefix="/api")
app.register_blueprint(ai_bp, url_prefix="/api")

# ── 页面路由 ──────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

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

    def _get_work_area(self):
        """获取屏幕工作区域（排除任务栏）"""
        try:
            import ctypes
            from ctypes import wintypes
            rect = wintypes.RECT()
            # SPI_GETWORKAREA = 0x0030
            ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0)
            return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top
        except Exception:
            return 0, 0, 1920, 1080

    def _save_restored_geometry(self):
        """保存还原时的窗口位置和大小"""
        try:
            pos = self._window.position
            size = self._window.size
            if pos and size and pos[0] is not None:
                self._restored_geom = {
                    "x": pos[0], "y": pos[1],
                    "w": size[0], "h": size[1]
                }
        except Exception:
            pass

    def toggle_maximize(self):
        if not self._window:
            return
        if self._maximized:
            # 还原
            geom = getattr(self, '_restored_geom', None)
            if geom:
                self._window.move(geom["x"], geom["y"])
                self._window.resize(geom["w"], geom["h"])
            self._maximized = False
        else:
            # 保存当前位置大小
            self._save_restored_geometry()
            # 最大化到工作区域
            x, y, w, h = self._get_work_area()
            self._window.move(x, y)
            self._window.resize(w, h)
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

    def read_clipboard(self):
        """读取剪贴板内容（使用 tkinter，无需额外依赖）"""
        try:
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()
            text = root.clipboard_get()
            root.destroy()
            return text
        except Exception:
            return ""

    def save_window_state(self, w, h, x, y, maximized):
        """JS 端关闭前调用，保存窗口状态"""
        settings = load_settings()
        settings["window"]["width"] = int(w)
        settings["window"]["height"] = int(h)
        settings["window"]["x"] = int(x)
        settings["window"]["y"] = int(y)
        settings["window"]["maximized"] = bool(maximized)
        save_settings(settings)

    def save_active_state(self, file_id, view_mode):
        """JS 端关闭前调用，保存活跃文件和视图模式"""
        settings = load_settings()
        settings["active_file_id"] = file_id if file_id else None
        settings["view_mode"] = view_mode
        save_settings(settings)

    def close(self):
        # 关闭前保存状态
        try:
            settings = load_settings()
            settings["window"]["maximized"] = self._maximized
            # 如果未最大化，保存当前位置大小
            if not self._maximized:
                geom = getattr(self, '_restored_geom', None)
                if geom:
                    settings["window"]["x"] = geom["x"]
                    settings["window"]["y"] = geom["y"]
                    settings["window"]["width"] = geom["w"]
                    settings["window"]["height"] = geom["h"]
            save_settings(settings)
        except Exception:
            pass
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

    # 初始化还原几何信息（用于最大化后还原）
    default_x = x if x is not None else 100
    default_y = y if y is not None else 100
    window_api._restored_geom = {"x": default_x, "y": default_y, "w": w, "h": h}

    # 设置 WebView2 用户数据目录（兼容 pyappify 沙箱环境）
    os.environ["WEBVIEW2_USER_DATA_FOLDER"] = str(DATA_DIR / "webview2")

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

    # 覆盖剪贴板读取方式
    def on_loaded():
        try:
            window.evaluate_js("""
                navigator.clipboard.readText = function() {
                    return window.pywebview.api.read_clipboard();
                };
            """)
        except Exception:
            pass
    window.events.loaded += on_loaded

    # 窗口关闭时保存状态
    def on_closing():
        settings = load_settings()
        settings["window"]["maximized"] = window_api._maximized
        # 如果锁屏处于显示状态，标记需要强制锁屏
        settings["lock"]["force_lock"] = window_api._locked
        save_settings(settings)
    window.events.closing += on_closing

    # 窗口显示后恢复最大化状态
    def _on_shown():
        if window_api._maximized:
            try:
                x, y, w, h = window_api._get_work_area()
                window.move(x, y)
                window.resize(w, h)
            except Exception:
                pass
    window.events.shown += _on_shown

    # 抑制 pywebview 退出时的清理报错（WebView2 临时目录已不存在）
    # 在文件描述符级别重定向 stderr，确保所有线程的输出都被抑制
    _real_stderr_fd = os.dup(2)
    devnull = os.open(os.devnull, os.O_WRONLY)
    os.dup2(devnull, 2)
    os.close(devnull)
    try:
        webview.start(gui="edgechromium")
    except Exception:
        pass
    # 恢复 stderr
    os.dup2(_real_stderr_fd, 2)
    os.close(_real_stderr_fd)
    os._exit(0)

if __name__ == "__main__":
    main()
