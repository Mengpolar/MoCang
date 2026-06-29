"""墨仓 | MoCang - 分组 API"""
from flask import Blueprint, request, jsonify

from utils import load_json, save_json, KNOWLEDGE_FILE, GROUPS_FILE

groups_bp = Blueprint("groups_bp", __name__)


@groups_bp.route("/groups", methods=["GET"])
def api_get_groups():
    return jsonify(load_json(GROUPS_FILE, []))


@groups_bp.route("/groups", methods=["POST"])
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


@groups_bp.route("/groups/<path:name>", methods=["DELETE"])
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
