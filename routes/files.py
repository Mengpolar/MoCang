"""墨仓 | MoCang - 知识库文件 API"""
import os
import re
import uuid
import markdown
from pathlib import Path
from flask import Blueprint, request, jsonify

from utils import load_json, save_json, KNOWLEDGE_FILE

files_bp = Blueprint("files_bp", __name__)


@files_bp.route("/files", methods=["GET"])
def api_get_files():
    return jsonify(load_json(KNOWLEDGE_FILE, []))


@files_bp.route("/files", methods=["POST"])
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


@files_bp.route("/files/<file_id>", methods=["DELETE"])
def api_delete_file(file_id):
    files = load_json(KNOWLEDGE_FILE, [])
    files = [f for f in files if f["id"] != file_id]
    save_json(KNOWLEDGE_FILE, files)
    return jsonify({"ok": True})


@files_bp.route("/files/<file_id>", methods=["PATCH"])
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


@files_bp.route("/content/<file_id>", methods=["GET"])
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


@files_bp.route("/save/<file_id>", methods=["POST"])
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


@files_bp.route("/search", methods=["GET"])
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
