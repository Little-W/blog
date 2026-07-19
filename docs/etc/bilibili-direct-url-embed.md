---
title: 解析 B 站视频直链并嵌入博客的方法
sidebar_label: B 站视频直链嵌入
---

# 解析 B 站视频直链并嵌入博客的方法

本文说明本站 MV 页当前使用的解析和嵌入方式。该方式只用于站点已收录、具有展示授权的视频；浏览器不保存 B 站 Cookie，也不提供任意 URL 的媒体转发接口。

## 问题定义

B 站网页中的视频通常由独立的视频轨道和音频轨道组成。播放信息接口返回带时效签名的 CDN URL、轨道初始化范围、索引范围、编码、码率和分辨率。仅将视频轨道 URL 赋给 HTML `<video>` 元素会缺少音频；将长期 Cookie 放入前端脚本会使会话泄露。

因此，嵌入实现需要满足以下条件：

1. 仅服务器保存登录会话。
2. 仅解析事先收录的 BVID 与分 P。
3. 按源站本次返回的轨道生成画质菜单。
4. 浏览器直接读取 CDN 媒体数据，不经本站转发媒体字节。
5. 短时 URL 失效或 CDN 节点不可用时，可重新取得播放信息。

## 生产部署结构

生产静态文件位于 `blog_static` 仓库。该仓库的 `netlify.toml` 将 `netlify/functions` 指定为 Function 目录；`netlify/functions/bili.mjs` 以 `/api/*` 处理解析请求。

```text
浏览器的 MV 页面
       │ GET /api/resolve?bvid=…&p=…
       ▼
Netlify Function
       │ 校验 catalog.mjs 中的 BVID 与分 P
       │ 读取并解密 Netlify Blobs 中的登录会话
       ▼
B 站视频资料接口与播放信息接口
       │ 返回 DASH 视频轨道、音频轨道及备用 URL
       ▼
浏览器的 Video.js/VHS
       │ 直接请求带签名的 UPOS CDN URL
       ▼
B 站 CDN
```

Function 不代理视频字节。它只返回媒体 URL、DASH MPD 内容和轨道元数据，因此媒体带宽不经过 Netlify Function。

## 从 BVID 到可播放轨道

页面请求如下接口：

```text
GET /api/resolve?bvid=BVxxxxxxxxxx&p=1
```

Function 执行以下步骤：

1. 检查 BVID 格式、分 P 是否为正整数，并在 `ALLOWED_MV_PAGES` 白名单中查找完全相同的条目。
2. 请求视频资料接口，取得指定分 P 的 `cid`、标题和投稿者资料。该资料可在 Function 的内存和 Netlify Blobs 中暂存，避免重复查询。
3. 以服务器端登录会话请求 `x/player/playurl`。当前参数包含 `fnval=4048`、`fourk=1`、`high_quality=1` 和 `platform=html5`。不固定 `qn`，由登录会话和视频自身决定可用的最高档位。
4. 从 `dash.video` 和 `dash.audio` 选择可播放的轨道。视频优先选择 AVC 编码，其后按码率选择；音频选择 AAC 轨道。
5. 对每个实际视频档位创建画质项，并生成包含一个视频 `AdaptationSet` 和一个音频 `AdaptationSet` 的 MPD 文本。

响应中的 `sources` 数组是画质菜单的唯一数据来源。画质名称使用接口的 `display_desc` 和帧率说明；接口未给出名称时再根据分辨率和质量编号生成名称。因而 1080P60、2K、4K、HDR 等项目只会在对应轨道存在时出现。

## 浏览器中的 DASH 嵌入

Function 返回的每个画质项包含 MPD 文本、分辨率、编码、码率及备用 URL。页面将 MPD 编码为 `data:application/dash+xml` URL，再传给 Video.js/VHS。MPD 的 `BaseURL` 使用绝对的 CDN URL，浏览器据此分别请求视频和音频字节范围。

```javascript
const source = resolved.sources.find((item) => item.code === selectedCode);
const mpdUrl = `data:application/dash+xml;charset=utf-8,${encodeURIComponent(source.manifest)}`;

player.src({
  src: mpdUrl,
  type: 'application/dash+xml',
});
```

这里的 MPD 必须声明两个 `AdaptationSet`。视频轨道包含 `width`、`height`、`frameRate`、`codecs` 和 `SegmentBase`；音频轨道也必须包含自己的 `codecs` 和 `SegmentBase`。缺少音频集合时，播放器会只显示无声画面；将 MPD 误标为 `video/mp4` 时，VHS 会按单文件 MP4 处理并装载失败。

本站默认选择已保存的画质。未保存或当前视频没有该档位时，选择 720P；720P 不存在时选择接口返回列表中的最高档位。画质菜单在首个媒体元数据到达前已经建立，但此时会暂时阻止播放和切源操作，避免 Video.js、VHS 与画质插件同时重设 source 后停留在 `0:00`。

## 单段 MP4 作为恢复路径

主播放方式是 DASH。发生装载错误后，页面会尝试同一 DASH 清单一次，再处理备用 URL。对于接口允许的标准画质，Function 还提供：

```text
GET /api/fast?bvid=…&p=…&cid=…&qn=…
```

该接口请求 HTML5 `durl` 数据，但只在以下条件同时满足时返回 MP4：

- 返回的实际画质编号等于请求的 `qn`；
- `durl` 只有一个分段；
- 该 BVID、分 P 与 `cid` 已通过白名单验证。

前端先以 `Range: bytes=0-0` 检查 MP4 主 URL 与备用 URL。若 MP4 不可用，播放器继续使用尚未尝试的 DASH 备用 URL。该顺序避免用降档 MP4 替换用户已选择的 DASH 画质。

## 时效 URL 与重试处理

播放信息中的 URL 具有时效性，且 CDN 节点可能出现瞬时网络错误。实现采用以下处理：

- `/api/resolve` 的页面内缓存有效期为两分钟，`/api/fast` 的页面内缓存有效期为 90 秒；解析失败不写入缓存。
- Function 内的 BVID/CID 资料可缓存，`/api/resolve` 响应使用 `no-store`；强制刷新会在播放信息请求中加入时间戳参数。
- 页面请求解析 API 时，对连接错误和 408、425、429、5xx 响应使用指数退避，最多额外请求三次。4xx 业务错误不重试。
- 媒体 URL 在九秒内未取得元数据时按一次媒体装载失败处理；随后依次尝试同一清单、MP4、DASH 备用 URL，再重新解析。
- Function 将国内镜像放在候选 URL 前，并保留 B 站原始 URL 和接口给出的备用 URL。播放器按候选顺序处理，不把某次错误写入持久化状态。

## 会话和接口限制

生产环境需要在 Netlify 项目中设置以下仅 Function 可见的变量：

| 变量 | 用途 |
| --- | --- |
| `BILI_SESSION_ENCRYPTION_KEY` | 用 AES-256-GCM 加密 Netlify Blobs 中的 Cookie。 |
| `BILI_PARSER_ADMIN_TOKEN` | 保护二维码登录、会话导入、状态和退出接口。 |
| `BILI_ALLOWED_ORIGIN` | 可选的允许来源；同源部署时可省略。 |

扫码登录由本地 `tools/bili_qr_login_gui.py` 发起。GUI 将管理员令牌保留在进程内；Function 从登录响应中提取 Cookie，经过加密后写入 Netlify Blobs。普通页面只能访问 `/api/resolve`、`/api/fast` 和 `/api/health`，管理员接口必须提供 `Authorization: Bearer <token>`。

不应实现“输入任意视频地址并返回媒体 URL”的接口。白名单、精确的来源检查、短时 URL 和不向浏览器传递 Cookie 是该设计的必要限制条件。

## 验证项目

- `/api/health` 返回 `authenticated: true`；
- 已收录视频的 `/api/resolve` 返回至少一项视频轨道和一项音频轨道；
- 画质菜单仅显示响应中存在的档位；
- 选择 1080P60、2K 或 4K 时，播放器使用对应的 DASH 项，而非静默改为较低档位；
- 断开一个候选 CDN 后，播放器可转向后续候选或重新解析；
- 未收录 BVID、错误分 P、任意外部 URL 及未带管理员令牌的管理请求均被拒绝；
- 构建产物、Git 状态和浏览器全局变量中不出现 Cookie 与管理员令牌。
