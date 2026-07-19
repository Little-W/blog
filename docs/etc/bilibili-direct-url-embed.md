---
title: 解析 B 站视频直链并嵌入博客的方法
sidebar_label: B 站视频直链嵌入
---

# 解析 B 站视频直链并嵌入博客的方法

音乐页中的 MV 播放器没有嵌入 B 站网页，也没有把一个普通 MP4 地址直接交给 `<video>`。它在 Netlify Function 中调用 B 站的资料和播放信息接口，取得当前账号、当前视频实际可用的 DASH 视频轨和音频轨，再在浏览器中用 Video.js/VHS 播放生成的 MPD 清单。

这种做法解决了三个直接影响播放器的问题：DASH 的音视频分轨、高画质档位的枚举，以及短时 CDN 地址失效后的重新获取。

## 为什么不能只放一个视频 URL

现代 B 站视频通常使用 MPEG-DASH。视频画面和音频是两条独立的 ISO-BMFF 轨道，播放信息中的 `dash.video` 与 `dash.audio` 分别给出它们的 URL、编码、码率和字节范围。

若将 `dash.video[0].baseUrl` 直接赋给 `<video src>`，浏览器最多只会播放无声画面。高画质也不会以“一个更大的 MP4 文件”的形式出现；1080P60、2K、4K、HDR 等项目是 `dash.video` 数组中的独立表示，必须和音频轨一起装配。

另一个特点是媒体地址带有时效签名。解析结果适合在页面内短时间使用，但不适合作为静态文件写进文章或 JSON 数据库。播放器发生网络错误时，重新请求播放信息通常比反复使用旧地址更有效。

## 当前页面的组成

本项目把静态 MV 数据、解析 Function 和播放脚本放在同一个博客仓库中：

```text
static/data/mv_bilibili.*.jsonl
        │  BVID、分 P、封面、标题和分类
        ▼
static/custom/js/aplayer.js
        │  GET /api/resolve?bvid=…&p=…
        ▼
netlify/functions/bili.mjs
        │  视频资料接口 + x/player/playurl
        ▼
带时效签名的 DASH 视频轨、音频轨和备用 CDN URL
        │
        ▼
Video.js + VHS ────────────────────────────────────> B 站 UPOS CDN
```

Function 不转发视频字节。它返回一个很小的 JSON 对象，其中包括 MPD 文本、每种画质的名称和备用地址；浏览器随后直接从 UPOS 下载音视频片段。因此，媒体流量不会经过 Netlify Function。

`scripts/build-bili-parser-catalog.mjs` 会从 MV 数据生成 `netlify/functions/catalog.mjs`。`/api/resolve` 使用这个目录查找 BVID 与分 P，随后取得 `cid`。这也使播放器数据和解析服务使用同一组 MV 条目。

## 从 BVID 找到 CID

`BVID` 标识一个投稿，但播放信息接口使用的是分 P 对应的 `cid`。Function 先请求：

```text
GET https://api.bilibili.com/x/web-interface/view?bvid=BVxxxxxxxxxx
```

返回数据中的 `pages[p - 1].cid` 即为目标分 P 的 CID。这个资料响应还提供视频标题和投稿者信息，播放器用它显示“MV 视频来源”和跳转到 B 站的地址。

CID 不会频繁变化，所以 `bili.mjs` 同时使用 Function 内存缓存和 Netlify Blobs 缓存资料结果。缓存只保存分 P、标题和投稿者，不保存短时播放 URL。这样冷启动后的 Function 不必每次重复查询资料接口，同时不会把过期播放地址交给浏览器。

## 请求完整 DASH 播放信息

有了 BVID 和 CID 后，Function 以已登录的 B 站会话请求：

```text
GET https://api.bilibili.com/x/player/playurl
    ?bvid=BVxxxxxxxxxx
    &cid=123456789
    &fnval=4048
    &fnver=0
    &fourk=1
    &high_quality=1
    &platform=html5
```

关键参数是 `fnval=4048`。它请求 DASH 数据，响应中会出现 `dash.video` 和 `dash.audio`。`fourk=1` 与登录会话共同决定是否返回更高画质；账号权限、投稿者设置和地区可用性仍由 B 站响应决定。

这里没有固定 `qn`。固定为 `qn=127` 看似是在请求最高画质，但在某些大会员会话中反而只得到降档结果。省略 `qn` 后，接口会返回本次请求可用的完整 DASH 视频轨列表，播放器可以据此建立真实的画质菜单。

Function 会将 Netlify 提供的访问者 IP 写入 `X-Real-IP` 请求头。B 站据此为观看者选择 UPOS 节点，而不是按照 Function 机房所在区域选择节点。解析结果中的主 URL 会优先改写为 `upos-sz-mirroralib.bilivideo.com`，同时保留 B 站原地址和接口给出的备用 URL。

## 从响应中生成画质菜单

播放信息中常见的画质编号如下：

| 质量编号 | 常见名称 |
| --- | --- |
| 64 | 720P |
| 74 | 720P60 |
| 80 | 1080P |
| 112 | 1080P+ |
| 116 | 1080P60 |
| 120 | 4K |
| 125 | HDR |
| 126 | 杜比视界 |
| 127 | 8K |

实际显示名称优先来自 `support_formats` 中的 `display_desc` 与 `superscript`，而不是只依赖质量编号。这样 `1080P60`、`4K`、HDR 等文字与 B 站当前响应保持一致。没有格式描述时，才按分辨率和编号生成后备名称。

同一个质量编号可能有 AVC、HEVC、AV1 等多个编码版本。当前代码优先选 AVC，其后按照码率选择。AVC 在浏览器和 Video.js/VHS 中的兼容性最好；如果某个档位只返回 HEVC 或 AV1，仍会保留该轨道，由浏览器决定是否能够解码。

每个画质项的返回结构大致如下：

```json
{
  "code": "dash-116",
  "qn": 116,
  "label": "1080P60",
  "resolution": "1920×1080",
  "type": "application/dash+xml",
  "manifest": "<?xml version=\"1.0\" ...>",
  "candidates": {
    "video": ["https://..."],
    "audio": ["https://..."]
  },
  "fastProgressive": true
}
```

画质菜单完全由 `dash.video` 的实际轨道生成。视频没有返回 2K、4K 或 HDR 轨道时，页面不会显示对应选项；返回了这些轨道时，播放器会显示它们。

## 用 MPD 把音视频轨交给播放器

MPEG-DASH 清单需要同时描述视频和音频。项目中的 `manifest()` 为所选画质生成一个静态 MPD，它有两个 `AdaptationSet`：

```xml
<AdaptationSet mimeType="video/mp4" contentType="video">
  <Representation id="video-116" bandwidth="..." codecs="avc1..."
                  width="1920" height="1080" frameRate="60">
    <BaseURL>https://...视频轨...</BaseURL>
    <SegmentBase indexRange="...">
      <Initialization range="..."/>
    </SegmentBase>
  </Representation>
</AdaptationSet>

<AdaptationSet mimeType="audio/mp4" contentType="audio">
  <Representation id="audio" bandwidth="..." codecs="mp4a.40.2">
    <BaseURL>https://...音频轨...</BaseURL>
    <SegmentBase indexRange="...">
      <Initialization range="..."/>
    </SegmentBase>
  </Representation>
</AdaptationSet>
```

`BaseURL` 指向绝对 CDN 地址，`SegmentBase` 中的 `Initialization` 和 `indexRange` 来自 B 站响应。VHS 先读取初始化区间和索引区间，再按时间位置请求媒体字节。缺少音频 `AdaptationSet` 会导致无声播放；把 MPD 错标为 `video/mp4` 则会让播放器按单文件 MP4 处理。

前端不必把 MPD 写入文件。它将字符串编码为 `data:` URL 后直接设置给 Video.js：

```javascript
const mpdUrl = `data:application/dash+xml;charset=utf-8,${encodeURIComponent(source.manifest)}`;

player.src({
  src: mpdUrl,
  type: 'application/dash+xml',
});
```

播放器创建时会先装入默认画质：优先使用用户上次保存的档位；没有保存结果时用 720P；当前视频没有 720P 时用接口返回的最高档位。画质选择器建立完成前，脚本会暂时拦截播放和切换操作，随后恢复用户在准备期间点击播放的意图。这个顺序避免 Video.js、VHS 和画质插件同时更换 source 而停在 `0:00`。

## 快速 MP4 与 DASH 的恢复顺序

正常情况下，播放器首先使用完整 DASH。DASH 能播放源站返回的全部质量等级，并同时保存视频、音频轨的候选 URL。

部分国内网络对低、中画质的渐进式 MP4 首帧响应更快，因此项目保留了与 BiliAnalysis 相同的 `durl` 请求方式：

```text
GET /api/fast?bvid=…&p=…&cid=…&qn=…
```

`/api/fast` 请求 HTML5 `playurl`，并只接受三项条件同时满足的结果：返回画质等于请求的 `qn`、`durl` 只有一个分段、该分段有 URL。若 B 站把请求降到 720P，或返回多段文件，接口会明确失败，播放器继续使用同档 DASH。这样快速 MP4 不会把用户选中的 1080P60、2K 或 4K 静默替换成低画质文件。

一次媒体装载失败后的处理顺序为：

1. 重新装载同一 DASH 清单；对 `data:` MPD 附加无意义的片段标记，使 VHS 新建 loader。
2. 对可用的标准质量请求同档位单段 MP4，并用 `Range: bytes=0-0` 预检主 URL 和备用 URL。
3. 轮换 DASH 视频轨、音频轨的备用 CDN 地址。
4. 重新请求 `/api/resolve`，取得新的签名 URL 和新的 CDN 候选项。

请求 `/api/resolve` 本身会对连接错误和 408、425、429、5xx 响应进行指数退避。失败结果不会写入页面缓存。强制重新解析时，脚本附加时间戳参数，Function 再将该参数转为 B 站请求中的时间戳，避免上游缓存重新返回已经失效的播放信息。

## 登录会话如何保存

高画质是否出现取决于 B 站账号状态。项目提供 `tools/bili_qr_login_gui.py`，它请求管理员接口生成二维码、轮询扫码状态，再由 Function 保存登录响应中的 Cookie。

Function 在写入 Netlify Blobs 前使用 AES-256-GCM 加密会话，保存期限为 30 天。页面请求 `/api/resolve` 时只会收到短时媒体 URL、MPD 和投稿者资料，不会收到 Cookie。二维码登录、会话导入、状态查询和退出接口位于 `/api/admin/*`，由 `BILI_PARSER_ADMIN_TOKEN` 认证。

部署所需的服务端变量如下：

| 变量 | 用途 |
| --- | --- |
| `BILI_SESSION_ENCRYPTION_KEY` | 生成 AES-256-GCM 密钥，用于加密 Netlify Blobs 中的会话。 |
| `BILI_PARSER_ADMIN_TOKEN` | 调用扫码登录、会话导入和退出接口的 Bearer Token。 |
| `BILI_ALLOWED_ORIGIN` | 可选的页面 Origin；同源部署时可省略。 |

这些变量由 Netlify Function 读取，不参与 Docusaurus 的浏览器构建。

## 本地调试与文件位置

本地调试可启动 `local-bili-parser`：

```bash
cd local-bili-parser
npm install
npm start
```

服务默认监听 `127.0.0.1:19180`，前端默认请求 `http://127.0.0.1:19180/api`。它使用相同的 `fnval=4048` 播放信息请求，并将独立音视频轨整理为本机 DASH 清单，便于检查不同账号和视频的真实画质列表。

实现的主要文件如下：

| 文件 | 内容 |
| --- | --- |
| `netlify/functions/bili.mjs` | Netlify 解析、登录会话、DASH MPD、快速 MP4 和重试数据。 |
| `netlify/functions/catalog.mjs` | 由 MV 数据生成的 BVID 与分 P 目录。 |
| `static/custom/js/aplayer.js` | MV 卡片、Video.js 初始化、画质切换、预检和恢复流程。 |
| `local-bili-parser/server.mjs` | 本机调试解析服务。 |
| `tools/bili_qr_login_gui.py` | B 站扫码登录图形工具。 |

检查某个视频是否真的支持高画质时，应看 `/api/resolve` 返回的 `sources` 数组，而不是只看投稿页的标题或播放器设置。`sources` 中的每一项都对应本次 `playurl` 响应的一条可播放 DASH 视频轨。
