"""墨仓 | MoCang - 共享工具函数"""
import hashlib
import hmac
import json
import os
import secrets
import sys
from pathlib import Path


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


# ── 设置 ──────────────────────────────────────────────────────

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
        "ui_blur": 0,
    },
    "software": {
        "auto_update": False,
        "show_resource": False,
    },
    "ai": {
        "enabled": False,
        "endpoint": "",
        "apikey": "",
        "model": "",
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


# ── 安全工具 ─────────────────────────────────────────────────

SECRET_KEY_FILE = DATA_DIR / ".secret_key"

def get_secret_key():
    """获取或生成持久化 secret key"""
    if SECRET_KEY_FILE.exists():
        return SECRET_KEY_FILE.read_text().strip()
    key = secrets.token_hex(32)
    SECRET_KEY_FILE.write_text(key)
    return key

PBKDF2_ITERATIONS = 100_000

def hash_password(password: str) -> str:
    """密码加盐哈希"""
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS)
    return f"pbkdf2:{salt}:{h.hex()}"

def verify_password(password: str, stored: str) -> bool:
    """验证密码"""
    if not stored or not password:
        return False
    # 兼容旧版明文密码：首次验证成功后自动升级为哈希
    if stored.startswith("pbkdf2:"):
        _, salt, h = stored.split(":", 2)
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS)
        return hmac.compare_digest(check.hex(), h)
    # 旧版明文比对（兼容）
    return hmac.compare_digest(password.encode(), stored.encode())

def needs_password_upgrade(stored: str) -> bool:
    """检查密码是否需要升级为哈希格式"""
    return stored and not stored.startswith("pbkdf2:")
