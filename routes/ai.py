"""墨仓 | MoCang - AI API"""
import json as _json
import urllib.request
from pathlib import Path

from flask import Blueprint, request, jsonify

from utils import load_settings

ai_bp = Blueprint("ai_bp", __name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _get_ai_config():
    """从本地设置读取 AI 配置（不从前端传入）"""
    settings = load_settings()
    ai = settings.get("ai", {})
    endpoint = (ai.get("endpoint") or "").strip()
    apikey = (ai.get("apikey") or "").strip()
    model = (ai.get("model") or "").strip()
    if endpoint and not endpoint.endswith("/chat/completions"):
        endpoint = endpoint.rstrip("/") + "/chat/completions"
    return endpoint, apikey, model


def _load_prompt(prompt_type):
    """从提示词 JSON 文件读取配置"""
    prompt_file = PROMPTS_DIR / f"{prompt_type}.json"
    if not prompt_file.exists():
        prompt_file = PROMPTS_DIR / "default.json"
    if prompt_file.exists():
        try:
            with open(prompt_file, "r", encoding="utf-8") as f:
                return _json.load(f)
        except Exception:
            pass
    return {"name": "默认", "temperature": 0.7, "system": ""}


def _call_ai(endpoint, apikey, model, messages, timeout=60, temperature=0.7):
    """调用 AI 接口"""
    payload = _json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "temperature": temperature,
    }).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {apikey}",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        result = _json.loads(resp.read().decode("utf-8"))
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return content


@ai_bp.route("/ai/test", methods=["POST"])
def api_ai_test():
    """测试 AI 接口连接（前端传入配置用于测试）"""
    data = request.get_json(silent=True) or {}
    endpoint = (data.get("endpoint") or "").strip()
    apikey = (data.get("apikey") or "").strip()
    model = (data.get("model") or "").strip()
    if endpoint and not endpoint.endswith("/chat/completions"):
        endpoint = endpoint.rstrip("/") + "/chat/completions"
    if not endpoint or not apikey or not model:
        return jsonify({"ok": False, "error": "参数不完整"})
    try:
        _call_ai(endpoint, apikey, model, [{"role": "user", "content": "hi"}], timeout=10)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@ai_bp.route("/ai/request", methods=["POST"])
def api_ai_request():
    """AI 请求接口（后端读取提示词和配置）"""
    data = request.get_json(silent=True) or {}
    prompt_type = data.get("type", "default")
    content = data.get("content", "")

    if not content.strip():
        return jsonify({"ok": False, "error": "内容不能为空"})

    # 检查 AI 是否启用
    settings = load_settings()
    if not settings.get("ai", {}).get("enabled"):
        return jsonify({"ok": False, "error": "AI 未启用"})

    # 读取后端配置
    endpoint, apikey, model = _get_ai_config()
    if not endpoint or not apikey or not model:
        return jsonify({"ok": False, "error": "AI 配置不完整"})

    # 读取提示词配置
    prompt_cfg = _load_prompt(prompt_type)
    system_prompt = prompt_cfg.get("system", "")
    temperature = prompt_cfg.get("temperature", 0.7)

    # 构建消息
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": content},
    ]

    try:
        result = _call_ai(endpoint, apikey, model, messages, temperature=temperature)
        return jsonify({"ok": True, "content": result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})
