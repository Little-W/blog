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

这些变量需要包含 Functions 作用域。更新变量后重新部署一次。

`GITHUB_SESSION_SECRET` 可用以下命令生成：

```bash
openssl rand -base64 48
```

## 4. 配置 GitHub Actions

在 `Little-W/blog` 的 `Settings > Secrets and variables > Actions` 中添加：

| Secret | 内容 |
| --- | --- |
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token |
| `NETLIFY_SITE_ID` | Netlify 项目 ID |

`.github/workflows/build-and-deploy.yml` 会在 `main` 分支每次提交后执行 `npm ci`、Docusaurus 构建和 Netlify 生产部署。如果 Netlify 仍开启仓库自动构建，同一次提交会产生两个部署任务；使用本工作流时应在 Netlify 中停止重复的仓库构建。

## 5. 使用方式

将鼠标移到博客侧栏头像上，在悬浮面板中选择 GitHub 登录。登录后可进入 `/admin`，手动编辑音乐与 MV 数据，或用 JSON / JSONL 新增、覆盖数据表。

登录状态下，文章页顶部会显示“编辑此页”按钮。保存时控制台会向 `main` 分支创建非强制 Git 提交；如果远程内容已变化，编辑器会要求重新加载，不会覆盖其他提交。
