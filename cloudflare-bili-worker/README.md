# Cloudflare Worker：音乐页 B 站 DASH 解析

这个目录把 Docusaurus 静态站和解析 API 部署到同一个 Cloudflare Worker：页面请求同源 `/api`，Worker 以站点管理员保存的 B 站会话请求播放信息，并只向浏览器返回短时 DASH 清单。播放器会把 B 站实际返回的每个视频轨道都显示出来，例如 1080P、1080P60、2K、4K、HDR；不存在的档位不会凭空显示。

会话 Cookie 只在 Worker 内使用，并以 AES-GCM 加密后存入 Workers KV。前端没有管理员令牌，也不能发起扫码登录。

## 部署

在站点根目录先生成要由 Worker 托管的静态文件：

```sh
cd /media/6/旧项目/网站/my-website
BILI_PARSER_API=/api BILI_PARSER_MODE=cloudflare npm run build
```

然后安装 Worker 依赖、登录 Cloudflare，并进行首次部署：

```sh
cd cloudflare-bili-worker
npm install
npx wrangler login
npm run deploy
```

首次部署会创建并绑定 `BILI_STATE` KV 命名空间。记下命令输出的 `https://…workers.dev` 地址；此时页面和 `/api` 都已经由同一 Worker 托管，但解析器还没有登录。

创建两个仅供 Worker 使用的密钥。`PARSER_ADMIN_TOKEN` 应为新的高强度随机值；`BILI_SESSION_ENCRYPTION_KEY` 建议用下面命令生成，长度至少 24 个字符。

```sh
openssl rand -base64 32
npx wrangler secret put PARSER_ADMIN_TOKEN
npx wrangler secret put BILI_SESSION_ENCRYPTION_KEY
npm run deploy
```

Cloudflare 的密钥通过 `wrangler secret put` 加密保存，不要写入 `wrangler.jsonc`、静态页面或 Git。KV 绑定可由 Wrangler 配置声明并在部署时创建；静态文件通过 Assets 绑定托管，而 `/api/*`、`/admin/*` 会优先交给 Worker 处理。[Cloudflare 密钥文档](https://developers.cloudflare.com/workers/configuration/secrets/)、[Wrangler 配置与 KV 绑定](https://developers.cloudflare.com/workers/wrangler/configuration/)、[Assets 的 `run_worker_first`](https://developers.cloudflare.com/workers/static-assets/binding/)。

最后在自己的终端中执行一次管理员扫码登录（令牌不会显示在页面或 QR 流程输出中）：

```sh
WORKER_URL=https://你的-worker.workers.dev \
PARSER_ADMIN_TOKEN='刚才设置的管理员令牌' \
npm run login
```

用 B 站 App 扫描终端二维码并确认。成功后刷新 Worker 地址下的 `/music/`；Worker 会从 B 站实际响应中列出可用轨道。当前音乐目录中若某支 MV 最高只提供 1080P，菜单就只会到 1080P；换成上游提供 1080P60、2K、4K 或 HDR 的 MV 时，对应选项会自动出现。

## 自定义域名与分离托管

最简单的方式是直接使用 Worker 的 `workers.dev` 地址，或在 Cloudflare Dashboard 为该 Worker 绑定自定义域名/路由。静态页面和 API 同源时，无需额外 CORS 设置。

若静态网站仍部署在其他域名，则重新构建时把 API 指向 Worker，并将 `wrangler.jsonc` 里的 `ALLOWED_SITE_ORIGIN` 改为**完整且唯一**的网站 Origin（例如 `https://example.github.io`），随后重新部署：

```sh
cd /media/6/旧项目/网站/my-website
BILI_PARSER_API=https://你的-worker.workers.dev/api \
BILI_PARSER_MODE=cloudflare npm run build

cd cloudflare-bili-worker
# 将 wrangler.jsonc 的 ALLOWED_SITE_ORIGIN 改为静态站 Origin 后：
npm run deploy
```

不要将 `ALLOWED_SITE_ORIGIN` 设为 `*`。本项目的 Worker 也只允许解析音乐目录内已收录的 BVID/分 P，避免把它变成开放视频代理。

## 运维

检查登录状态（不会泄露 Cookie）：

```sh
curl -H "Authorization: Bearer $PARSER_ADMIN_TOKEN" \
  https://你的-worker.workers.dev/admin/status
```

若 B 站会话过期，重新运行 `npm run login` 即可；需要主动清除会话时：

```sh
curl -X POST -H "Authorization: Bearer $PARSER_ADMIN_TOKEN" \
  https://你的-worker.workers.dev/admin/logout
```

播放清单有效期为 90 分钟，页面会在重新点播时生成新清单。B 站可能因数据中心出口、风控或帐号状态拒绝 Worker 请求；这是上游限制，部署后请实际点播一支收录 MV 验证。

## 本地调试

复制 `.dev.vars.example` 为 `.dev.vars`，填写测试值后运行：

```sh
npm run dev
```

`.dev.vars` 包含密钥，已经被 Git 忽略，不能提交。
