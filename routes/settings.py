"""墨仓 | MoCang - 设置 API"""
import os
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file

from utils import (
    load_json, save_json, load_settings, save_settings,
    hash_password, verify_password, needs_password_upgrade,
    BASE_DIR, DATA_DIR,
)

settings_bp = Blueprint("settings_bp", __name__)


@settings_bp.route("/settings", methods=["GET"])
def api_get_settings():
    return jsonify(load_settings())


@settings_bp.route("/settings", methods=["POST"])
def api_save_settings():
    data = request.get_json(silent=True) or {}
    current = load_settings()
    # 深度合并
    for k, v in data.items():
        if isinstance(v, dict) and k in current and isinstance(current[k], dict):
            current[k].update(v)
        else:
            current[k] = v
    # 密码哈希处理
    pwd = current.get("lock", {}).get("password", "")
    if pwd and not pwd.startswith("pbkdf2:"):
        current["lock"]["password"] = hash_password(pwd)
    save_settings(current)
    return jsonify({"ok": True})


@settings_bp.route("/settings/verify-lock", methods=["POST"])
def api_verify_lock():
    """验证锁屏密码"""
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    settings = load_settings()
    stored = settings.get("lock", {}).get("password", "")
    if not stored:
        return jsonify({"ok": True, "msg": "未设置密码"})
    if verify_password(password, stored):
        # 旧版明文密码自动升级为哈希
        if needs_password_upgrade(stored):
            settings["lock"]["password"] = hash_password(password)
            save_settings(settings)
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "密码错误"}), 401


@settings_bp.route("/settings/upload-bg", methods=["POST"])
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
    # 保存相对路径，兼容不同工作目录
    rel_path = str(Path("data") / "backgrounds" / filename)
    settings = load_settings()
    settings["interface"]["background_image"] = rel_path
    save_settings(settings)
    return jsonify({"ok": True, "path": rel_path})


@settings_bp.route("/settings/remove-bg", methods=["POST"])
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


@settings_bp.route("/background", methods=["GET"])
def api_get_background():
    """返回背景图片"""
    settings = load_settings()
    bg_path = settings.get("interface", {}).get("background_image", "")
    if not bg_path:
        return "", 404
    # 兼容绝对路径和相对路径
    full_path = bg_path if os.path.isabs(bg_path) else str(BASE_DIR / bg_path)
    if os.path.isfile(full_path):
        return send_file(full_path)
    return "", 404
