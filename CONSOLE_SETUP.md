# 博客管理控制台配置

## 1. 创建 GitHub OAuth App

在 GitHub 的 `Settings > Developer settings > OAuth Apps` 中创建应用，填写：

- Homepage URL：`https://blog.yusen.best`
- Authorization callback URL：`https://blog.yusen.best/api/console/callback`

创建后保存 Client ID 和 Client Secret。浏览器只会得到 HttpOnly 会话 Cookie，OAuth 令牌不会写入前端存储。

## 2. 创建仓库写入令牌

创建 fine-grained personal access token，仓库只选择 `Little-W/blog`，Repository permissions 中的 Contents 设为 `Read and write`。不需要授权其他仓库或账号权限。

该令牌仅保存在 Netlify 服务端环境变量中。控制台用 GitHub OAuth 确认访问者身份，服务端再比较 GitHub 用户 ID 和仓库所有者 ID。

## 3. 配置 Netlify 环境变量

在 Netlify 项目的 `Project configuration > Environment variables` 中添加：

| 变量 | 内容 |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | OAuth App Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth App Client Secret |
| `GITHUB_OAUTH_PUBLIC_ORIGIN` | `https://blog.yusen.best` |
| `GITHUB_SESSION_SECRET` | 不少于 32 字符的随机密钥 |
| `GITHUB_REPO_TOKEN` | 仅可读写 `Little-W/blog` 的 fine-grained PAT |
| `GITHUB_REPO_OWNER` | `Little-W` |
| `GITHUB_REPO_NAME` | `blog` |
| `GITHUB_REPO_BRANCH` | `main` |
| `PIXIV_REFRESH_TOKEN` | Pixiv 账号 refresh token（`node scripts/pixiv-token.mjs` 导出） |
| `BILI_SESSION_ENCRYPTION_KEY` | B 站会话加密密钥，不少于 24 字符 |
| `BILI_PARSER_ADMIN_TOKEN` | B 站解析管理接口使用的 Bearer token |
| `SILICONFLOW_API_KEY` | 看板娘 AI 对话 API Key |

这些变量需要包含 Functions 作用域。`GITHUB_REPO_OWNER/NAME/BRANCH` 默认分别为 `Little-W`、`blog`、`main`；`PIXIV_CLIENT_ID/PIXIV_CLIENT_SECRET` 使用内置值即可，无需设置。`GITHUB_OAUTH_PUBLIC_ORIGIN`、`BILI_ALLOWED_ORIGIN` 和 `WAIFU_CHAT_PUBLIC_ORIGIN` 建议设为 `https://blog.yusen.best`。更新变量后重新部署一次。

`GITHUB_SESSION_SECRET` 可用以下命令生成：

```bash
openssl rand -base64 48
```

## 4. 配置 GitHub Actions

在 `Little-W/blog` 的 `Settings > Environments > github-pages` 中添加以下 Secret：

| Secret | 内容 |
| --- | --- |
| `BLOG_STATIC_TOKEN` | 仅可读写 `Little-W/blog_static` 的 fine-grained PAT，Contents 设为 `Read and write` |

`.github/workflows/build-and-deploy.yml` 会在 `main` 分支每次提交后执行 `npm ci`、Docusaurus 构建，并将静态文件和 Functions 同步推送到 `Little-W/blog_static`。Netlify 通过该发布仓库自动部署；当前工作流不使用 `NETLIFY_AUTH_TOKEN` 或 `NETLIFY_SITE_ID`。

## 5. 使用方式

将鼠标移到博客侧栏头像上，在悬浮面板中选择 GitHub 登录。登录后可进入 `/admin`，手动编辑音乐与 MV 数据，或用 JSON / JSONL 新增、覆盖数据表。

登录状态下，文章页顶部会显示“编辑此页”按钮。保存时控制台会向 `main` 分支创建非强制 Git 提交；如果远程内容已变化，编辑器会要求重新加载，不会覆盖其他提交。
