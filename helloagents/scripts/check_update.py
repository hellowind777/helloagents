#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS 更新检查脚本（带每日缓存）

会话启动时由 AI 静默调用，每天最多检查一次远程版本。
检测到新版本时输出提示信息，否则无输出。
任何错误均静默退出（exit 0），不影响正常流程。

Usage:
    python check_update.py
    python check_update.py --helloagents-root /path/to/helloagents_root

Examples:
    python check_update.py
    python check_update.py --helloagents-root ~/.claude/helloagents
"""

import json
import re
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request

# 缓存有效期（秒）：24 小时
CACHE_TTL = 86400

# 网络请求超时（秒）
NETWORK_TIMEOUT = 3

REPO_URL = "https://github.com/hellowind777/helloagents"
REPO_API_LATEST = "https://api.github.com/repos/hellowind777/helloagents/releases/latest"


def _get_cache_path(helloagents_root: Path) -> Path:
    """获取缓存文件路径: {HELLOAGENTS_ROOT}/user/.update_cache"""
    return helloagents_root / "user" / ".update_cache"


def _read_cache(cache_path: Path) -> dict:
    """读取缓存文件，失败返回空字典。"""
    try:
        if cache_path.exists():
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def _write_cache(cache_path: Path, data: dict) -> None:
    """写入缓存文件，静默处理错误。"""
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(data, ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception:
        pass


def _parse_version(ver: str) -> tuple:
    """解析版本号为数字元组 + 是否稳定版。"""
    match = re.match(r"^(\d+(?:\.\d+)*)", ver)
    if not match:
        return (), False
    numeric = tuple(int(x) for x in match.group(1).split("."))
    is_stable = match.group(0) == ver
    return numeric, is_stable


def _version_newer(remote: str, local: str) -> bool:
    """判断远程版本是否比本地更新。"""
    r_num, r_stable = _parse_version(remote)
    l_num, l_stable = _parse_version(local)
    if not r_num or not l_num:
        return False
    if r_num != l_num:
        return r_num > l_num
    return r_stable and not l_stable


def _get_local_version() -> str:
    """获取本地安装版本。"""
    from importlib.metadata import version
    return version("helloagents")


def _detect_channel() -> str:
    """检测安装分支。"""
    try:
        from importlib.metadata import distribution
        dist = distribution("helloagents")
        raw = dist.read_text("direct_url.json")
        if raw:
            info = json.loads(raw)
            ref = info.get("vcs_info", {}).get("requested_revision", "")
            if ref:
                return ref
    except Exception:
        pass
    return "main"


def _fetch_remote_version(branch: str) -> str:
    """从 GitHub 获取远程版本号。"""
    if branch == "main":
        try:
            req = Request(REPO_API_LATEST, headers={
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "helloagents-update-checker",
            })
            with urlopen(req, timeout=NETWORK_TIMEOUT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                ver = data.get("tag_name", "").lstrip("v")
                if ver:
                    return ver
        except Exception:
            pass
    # 回退：从 pyproject.toml 读取
    try:
        url = f"https://raw.githubusercontent.com/hellowind777/helloagents/{branch}/pyproject.toml"
        req = Request(url, headers={"User-Agent": "helloagents-update-checker"})
        with urlopen(req, timeout=NETWORK_TIMEOUT) as resp:
            content = resp.read().decode("utf-8")
        m = re.search(r'version\s*=\s*"([^"]+)"', content)
        return m.group(1) if m else ""
    except Exception:
        return ""


def main() -> None:
    """主入口：检查缓存 → 按需网络请求 → 输出结果。"""
    import argparse
    parser = argparse.ArgumentParser(description="HelloAGENTS 更新检查")
    parser.add_argument("--helloagents-root", type=str, default=None,
                        help="HelloAGENTS 根目录路径")
    args = parser.parse_args()

    # 确定 HELLOAGENTS_ROOT
    if args.helloagents_root:
        root = Path(args.helloagents_root)
    else:
        root = Path(__file__).parent.parent

    cache_path = _get_cache_path(root)
    cache = _read_cache(cache_path)

    now = time.time()
    last_check = cache.get("last_check", 0)

    # 缓存未过期：直接使用缓存结果
    if now - last_check < CACHE_TTL:
        if cache.get("has_update"):
            # 验证本地版本是否已变化（用户可能已执行 update）
            try:
                current_ver = _get_local_version()
                if current_ver != cache.get("local_version"):
                    # 本地版本已变化，缓存失效，跳过提示等待下次检查
                    return
            except Exception:
                pass
            local_ver = cache.get("local_version", "?")
            remote_ver = cache.get("remote_version", "?")
            print(f"⬆️ 发现 HelloAGENTS 新版本 {remote_ver}（当前 {local_ver}），"
                  f"请退出当前 CLI 工具使用 `helloagents update` 命令升级。")
        return

    # 缓存已过期：执行网络检查
    local_ver = _get_local_version()
    branch = _detect_channel()
    remote_ver = _fetch_remote_version(branch)

    has_update = bool(remote_ver and _version_newer(remote_ver, local_ver))

    # 写入缓存
    _write_cache(cache_path, {
        "last_check": now,
        "has_update": has_update,
        "local_version": local_ver,
        "remote_version": remote_ver,
        "branch": branch,
    })

    if has_update:
        print(f"⬆️ 发现 HelloAGENTS 新版本 {remote_ver}（当前 {local_ver}），"
              f"请退出当前 CLI 工具使用 `helloagents update` 命令升级。")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # 任何异常均静默退出，不影响 AI 会话
        pass
