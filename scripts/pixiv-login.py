#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pixiv RefreshToken 导出脚本（本地手动登录）

流程（Pixiv 官方 App 公开使用的 OAuth PKCE）：
  1. 本脚本生成 code_verifier / code_challenge，并打印登录网址；
  2. 你在浏览器里手动登录 Pixiv 账号；
  3. 登录成功后页面会跳转到 pixiv://account/login?code=xxx（打不开属正常），
     把地址栏里的整段链接或其中的 code 复制回本脚本；
  4. 脚本用 code 换取 access_token / refresh_token，并写入 .pixiv-token.json。

说明：仅用于导出你本人账号的令牌，请遵守 Pixiv 服务条款，勿分享 refresh_token。
若网络无法直连 Pixiv，可先设置代理：export HTTPS_PROXY=http://127.0.0.1:端口

用法：
  python3 scripts/pixiv-login.py                # 交互式，自动打开浏览器
  python3 scripts/pixiv-login.py --print-only   # 只打印登录网址
  python3 scripts/pixiv-login.py --code=xxxxx   # 直接传入回调 code
"""

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = ROOT / ".pixiv-token.json"

# Pixiv 官方 App 内置客户端凭据（公开常量），可用环境变量覆盖。
CLIENT_ID = os.environ.get("PIXIV_CLIENT_ID", "MOBrBDS8blbauoSck0ZfDbtuzpyT")
CLIENT_SECRET = os.environ.get("PIXIV_CLIENT_SECRET", "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj")

BASE_URL = "https://app-api.pixiv.net"
OAUTH_URL = "https://oauth.secure.pixiv.net"
REDIRECT_URI = f"{BASE_URL}/web/v1/users/auth/pixiv/callback"
APP_HEADERS = {
    "App-OS": "android",
    "App-OS-Version": "15",
    "App-Version": "6.180.0",
    "Accept-Language": "zh-CN",
    "User-Agent": "PixivAndroidApp/6.180.0 (Android 15; Pixel 9)",
}


def base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def create_pkce():
    code_verifier = base64url(os.urandom(64))
    code_challenge = base64url(hashlib.sha256(code_verifier.encode("ascii")).digest())
    return code_verifier, code_challenge


def build_login_url(code_challenge: str) -> str:
    params = urllib.parse.urlencode(
        {
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "client": "pixiv-android",
        }
    )
    return f"{BASE_URL}/web/v1/login?{params}"


def post_form(url: str, form: dict) -> str:
    """用 curl 发请求：部分环境下 Python/Node 的 TLS 指纹会被 Pixiv 拒绝，curl 更稳。"""
    data = urllib.parse.urlencode(form)
    if shutil.which("curl"):
        args = [
            "curl", "-sS", "--max-time", "30",
            "-X", "POST", url,
            "-H", "Content-Type: application/x-www-form-urlencoded",
        ]
        for key, value in APP_HEADERS.items():
            args += ["-H", f"{key}: {value}"]
        args += ["--data", data]
        proc = subprocess.run(args, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or f"curl 退出码 {proc.returncode}")
        return proc.stdout

    request = urllib.request.Request(
        url,
        data=data.encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded", **APP_HEADERS},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def exchange_code(code: str, code_verifier: str) -> dict:
    raw = post_form(
        f"{OAUTH_URL}/auth/token",
        {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
            "code_verifier": code_verifier,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
            "include_policy": "true",
        },
    )
    try:
        payload = json.loads(raw)
    except ValueError:
        raise RuntimeError(f"Pixiv 返回了非 JSON 响应：{raw[:300]}")

    auth = payload.get("response")
    if not auth or not auth.get("refresh_token"):
        reason = payload.get("error") or payload.get("message") or raw[:300]
        raise RuntimeError(f"换取 token 失败：{reason}")
    return auth


def extract_code(text: str):
    value = (text or "").strip()
    if not value:
        return None
    matched = re.search(r"[?&]code=([^&\s]+)", value)
    if matched:
        return urllib.parse.unquote(matched.group(1))
    # 直接粘贴的 code 形如 "xxxxx-xxxxxxxxxxxx"
    if re.fullmatch(r"[A-Za-z0-9._~-]+", value):
        return value
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="导出 Pixiv refresh_token")
    parser.add_argument("--print-only", action="store_true", help="只打印登录网址")
    parser.add_argument("--code", default="", help="直接传入回调 code")
    args = parser.parse_args()

    code_verifier, code_challenge = create_pkce()
    login_url = build_login_url(code_challenge)

    print("\n=== Pixiv 登录（OAuth PKCE）===\n")
    print("登录网址：\n", login_url, "\n")

    if args.print_only:
        print("（--print-only：未进行换取，code_verifier 已丢弃，请重新运行完成登录）\n")
        return 0

    print("正在尝试打开浏览器……如未打开请手动复制上面的网址。")
    try:
        webbrowser.open(login_url)
    except Exception:
        pass
    print("登录成功后页面会跳转到 pixiv://account/login?code=... （打不开属正常），")
    print("请复制地址栏整段链接或其中的 code。\n")

    code = extract_code(args.code) if args.code else None
    while not code:
        answer = input("粘贴回调链接或 code：")
        code = extract_code(answer)
        if not code:
            print("未能识别 code，请重试。")

    print("\n正在用 code 换取 token……")
    auth = exchange_code(code, code_verifier)

    user = auth.get("user") or {}
    record = {
        "clientId": CLIENT_ID,
        "refreshToken": auth.get("refresh_token"),
        "accessToken": auth.get("access_token"),
        "expiresIn": auth.get("expires_in"),
        "user": {"id": user.get("id"), "name": user.get("name"), "account": user.get("account")} if user else None,
        "obtainedAt": datetime.now(timezone.utc).astimezone().isoformat(),
    }
    TOKEN_FILE.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        os.chmod(TOKEN_FILE, 0o600)
    except OSError:
        pass

    print("\n✅ 登录成功！")
    if record["user"]:
        print(f"账号：{record['user']['name']}（id {record['user']['id']}）")
    print(f"令牌已写入：{TOKEN_FILE.relative_to(ROOT)}（已加入 .gitignore，请勿提交/分享）\n")
    print("下一步：把 refresh_token 配到 Netlify 环境变量，即可启用 P站美图榜：")
    print(f"  PIXIV_REFRESH_TOKEN = {record['refreshToken'][:12]}…（完整值见上述文件）")
    print("  PIXIV_CLIENT_ID     = （可选，默认使用官方 App 常量，可留空）\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n已取消。")
        sys.exit(130)
    except Exception as error:  # noqa: BLE001
        print(f"\n❌ 登录失败：{error}")
        print("提示：Pixiv 可能需要可直连的网络（或设置 HTTPS_PROXY 后再试）。\n")
        sys.exit(1)
