#!/usr/bin/env python3
"""Local QR-login controller for the deployed Netlify Bilibili parser."""

from __future__ import annotations

import json
import os
import queue
import threading
import tkinter as tk
from tkinter import messagebox, ttk
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import qrcode
    from PIL import ImageTk
except ImportError as exc:
    raise SystemExit(
        'Missing QR dependencies. Run: python3 -m pip install -r tools/requirements-bili-qr-gui.txt'
    ) from exc


DEFAULT_API = 'https://blog.yusen.best/api'
POLL_INTERVAL_MS = 1500


class BiliLoginApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title('B 站扫码登录 · Netlify 解析服务')
        self.root.minsize(580, 580)
        self.root.columnconfigure(0, weight=1)

        self.api_url = tk.StringVar(value=os.environ.get('BILI_PARSER_API', DEFAULT_API))
        self.admin_token = tk.StringVar(value=os.environ.get('BILI_PARSER_ADMIN_TOKEN', ''))
        self.status_text = tk.StringVar(value='请输入管理员令牌，然后点击“生成二维码”。')
        self.qr_key: str | None = None
        self.qr_image: ImageTk.PhotoImage | None = None
        self.results: queue.Queue[tuple[str, object]] = queue.Queue()
        self.poll_after_id: str | None = None
        self.request_in_flight = False

        form = ttk.Frame(root, padding=18)
        form.grid(row=0, column=0, sticky='nsew')
        form.columnconfigure(1, weight=1)

        ttk.Label(form, text='解析 API').grid(row=0, column=0, sticky='w', pady=(0, 8))
        ttk.Entry(form, textvariable=self.api_url, width=58).grid(row=0, column=1, sticky='ew', pady=(0, 8))
        ttk.Label(form, text='管理员令牌').grid(row=1, column=0, sticky='w', pady=(0, 14))
        ttk.Entry(form, textvariable=self.admin_token, show='●', width=58).grid(row=1, column=1, sticky='ew', pady=(0, 14))

        actions = ttk.Frame(form)
        actions.grid(row=2, column=0, columnspan=2, sticky='w')
        self.login_button = ttk.Button(actions, text='生成二维码', command=self.start_login)
        self.login_button.grid(row=0, column=0, padx=(0, 8))
        ttk.Button(actions, text='检查登录状态', command=self.check_status).grid(row=0, column=1)

        self.qr_label = ttk.Label(form, anchor='center', text='二维码将在这里显示', relief='solid', padding=18)
        self.qr_label.grid(row=3, column=0, columnspan=2, pady=(20, 12))
        ttk.Label(form, textvariable=self.status_text, wraplength=520, justify='center').grid(
            row=4, column=0, columnspan=2, sticky='ew'
        )
        ttk.Label(
            form,
            text='令牌只保留在当前窗口内，不会写入磁盘。扫码并在 B 站 App 内确认后，登录会话由服务端加密保存。',
            wraplength=520,
            justify='left',
        ).grid(row=5, column=0, columnspan=2, sticky='ew', pady=(16, 0))

        self.root.after(100, self.consume_results)
        self.root.protocol('WM_DELETE_WINDOW', self.close)

    def base_url(self) -> str:
        value = self.api_url.get().strip().rstrip('/')
        if not value.startswith(('https://', 'http://')):
            raise ValueError('解析 API 必须以 http:// 或 https:// 开头。')
        return value

    @staticmethod
    def request(api_url: str, token: str, method: str, path: str) -> dict:
        request = Request(
            f'{api_url}{path}',
            method=method,
            headers={
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json',
            },
        )
        try:
            with urlopen(request, timeout=20) as response:
                body = response.read().decode('utf-8')
        except HTTPError as error:
            body = error.read().decode('utf-8', errors='replace')
            try:
                payload = json.loads(body)
                raise RuntimeError(payload.get('message') or f'HTTP {error.code}') from error
            except json.JSONDecodeError:
                raise RuntimeError(f'HTTP {error.code}: {body}') from error
        except URLError as error:
            raise RuntimeError(f'无法连接解析服务：{error.reason}') from error
        payload = json.loads(body)
        if not payload.get('success'):
            raise RuntimeError(payload.get('message') or '解析服务返回失败。')
        return payload.get('data') or {}

    def run_request(self, kind: str, method: str, path: str) -> None:
        if self.request_in_flight:
            return
        try:
            api_url = self.base_url()
            token = self.admin_token.get().strip()
            if not token:
                raise ValueError('请输入 Netlify 中的 BILI_PARSER_ADMIN_TOKEN。')
        except ValueError as error:
            self.status_text.set(str(error))
            self.login_button.state(['!disabled'])
            return
        self.request_in_flight = True

        def worker() -> None:
            try:
                self.results.put((kind, self.request(api_url, token, method, path)))
            except Exception as error:  # the UI turns every request failure into a visible status
                self.results.put(('error', str(error)))

        threading.Thread(target=worker, daemon=True).start()

    def start_login(self) -> None:
        self.cancel_polling()
        self.login_button.state(['disabled'])
        self.status_text.set('正在获取 B 站二维码…')
        self.run_request('qr', 'POST', '/admin/login/qr')

    def check_status(self) -> None:
        self.status_text.set('正在检查服务端登录状态…')
        self.run_request('status', 'GET', '/admin/status')

    def poll(self) -> None:
        if self.qr_key and not self.request_in_flight:
            self.run_request('poll', 'GET', f'/admin/login/qr/status?key={self.qr_key}')

    def schedule_poll(self) -> None:
        self.cancel_polling()
        self.poll_after_id = self.root.after(POLL_INTERVAL_MS, self.poll)

    def cancel_polling(self) -> None:
        if self.poll_after_id:
            self.root.after_cancel(self.poll_after_id)
            self.poll_after_id = None

    def show_qr(self, url: str) -> None:
        image = qrcode.make(url).resize((280, 280))
        self.qr_image = ImageTk.PhotoImage(image)
        self.qr_label.configure(image=self.qr_image, text='')

    def consume_results(self) -> None:
        try:
            while True:
                kind, result = self.results.get_nowait()
                self.request_in_flight = False
                if kind == 'error':
                    self.status_text.set(str(result))
                    self.login_button.state(['!disabled'])
                    self.cancel_polling()
                elif kind == 'qr':
                    data = result if isinstance(result, dict) else {}
                    self.qr_key = str(data.get('key') or '')
                    self.show_qr(str(data.get('url') or ''))
                    self.status_text.set('请用 B 站 App 扫码并确认授权；窗口会自动确认登录结果。')
                    self.login_button.state(['!disabled'])
                    self.schedule_poll()
                elif kind == 'poll':
                    data = result if isinstance(result, dict) else {}
                    if data.get('state') == 'success':
                        self.status_text.set('登录成功：服务端已加密保存会话，可以关闭本工具。')
                        self.cancel_polling()
                    else:
                        self.status_text.set(str(data.get('message') or '等待扫码确认…'))
                        self.schedule_poll()
                elif kind == 'status':
                    data = result if isinstance(result, dict) else {}
                    self.status_text.set('服务端已登录。' if data.get('authenticated') else '服务端尚未登录。')
        except queue.Empty:
            pass
        self.root.after(100, self.consume_results)

    def close(self) -> None:
        self.cancel_polling()
        self.root.destroy()


if __name__ == '__main__':
    window = tk.Tk()
    BiliLoginApp(window)
    window.mainloop()
