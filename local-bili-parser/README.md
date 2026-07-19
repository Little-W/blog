# 本地 B 站直链解析服务

这个服务按 `bilidown` 的流程工作：在本机生成 B 站扫码登录二维码、只在本机保存登录 Cookie、再用已登录会话请求官方播放接口。音乐页只接收本机生成的短时 DASH 播放清单；Cookie 不会发送给网页，也不会保存到仓库。

服务默认只监听 `127.0.0.1:19180`，会话保存到 `~/.local/share/my-website-bili-player/session.json`（目录权限 `0700`、文件权限 `0600`）。不要把这个目录、二维码 URL 或解析出的临时播放地址上传到公共位置。

## 启动

```bash
cd /media/6/旧项目/网站/my-website/local-bili-parser
npm install
npm start
```

本地启动 Docusaurus（默认 `http://localhost:3000`）后，打开音乐页并播放任意 MV。未登录时点“扫码登录”，用 B 站 App 确认即可；服务会把登录信息仅写入上述本地目录。

若网站不是从本地 `3000` 端口打开，必须显式指定准确的页面来源，不能使用 `*`：

```bash
npm start -- --allow-origin https://你的站点.example
```

多个来源以逗号分隔。保存目录也可以调整：

```bash
npm start -- --data-dir /安全的本地目录 --allow-origin https://你的站点.example
```

页面默认连接 `http://127.0.0.1:19180/api`。如确实需要改端口，须在网站脚本加载前设置 `window.MY_WEBSITE_BILI_LOCAL_API` 为新的完整 API 地址，例如 `http://127.0.0.1:19181/api`；否则保持默认端口即可。

## 画质行为

解析服务使用与 `bilidown` 相同的 `x/player/playurl?fnval=4048`，读取完整 DASH 视频/音频轨道。因此帐号和视频允许时，画质菜单会出现 `1080P60`、`2K`、`4K` 等，而不受渐进式 MP4 档位限制。服务只代理已解析轨道的 Range 请求，并将视频、音频组合为本机 DASH 播放清单；不会接收任意外部媒体 URL。

画质标签来自实际返回的 DASH 轨道，并在播放器加载后再次核验分辨率。它不会把被降级的 720P 冒充成 1080P。

不同视频、帐号权限和地区可用档位不同。某个源本身没有 1080P 时，页面会只显示其真实可用画质；无法通过登录凭空产生 1080P。

## 接口

所有接口均为本机回环服务，且受 `--allow-origin` 精确白名单约束：

- `GET /api/health`：检查登录状态；
- `POST /api/login/qr`：生成二维码；
- `GET /api/login/qr/status?key=...`：查询扫码结果并保存会话；
- `GET /api/resolve?bvid=...&p=...`：返回各个真实可用 DASH 画质的本机播放清单；
- `POST /api/logout`：删除本机已保存的会话。

媒体 Range 请求经本机服务转发至 B 站 CDN，以便浏览器安全组合独立的视频、音频轨道。服务不接收任意媒体 URL，也不向浏览器返回 Cookie。
