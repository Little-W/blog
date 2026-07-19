# B 站扫码登录 GUI

这是给 Netlify 解析后端使用的本地控制工具。它显示 B 站二维码并轮询登录结果；管理员令牌只保留在当前窗口内，登录 Cookie 不会写入本机。

```bash
python3 -m venv .venv-bili-qr
.venv-bili-qr/bin/python -m pip install -r tools/requirements-bili-qr-gui.txt
.venv-bili-qr/bin/python tools/bili_qr_login_gui.py
```

API 默认填入 `https://blog.yusen.best/api`。输入 Netlify 中配置的 `BILI_PARSER_ADMIN_TOKEN`，点击“生成二维码”，再使用 B 站 App 扫码确认即可。
