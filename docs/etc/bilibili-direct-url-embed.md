---
title: 解析 B 站视频直链并嵌入博客的方法
sidebar_label: B 站视频直链嵌入
---

# 解析 B 站视频直链并嵌入博客的方法

将 B 站 MV 放入静态博客，最容易想到的方式是插入 B 站 `<iframe>`。这种方式不需要处理媒体地址，但播放器外观、画质菜单、加载失败后的恢复行为都由 B 站页面控制。音乐页需要把 MV 和站内主题、来源信息、画质选择放进同一套界面，因此使用了另一种方式：后端取得播放资料，前端直接播放 B 站 CDN 返回的短时媒体地址。

本项目没有把视频下载后重新托管。Netlify Function 只负责请求资料接口、保存登录会话、整理播放信息；浏览器仍然直接向 B 站 UPOS CDN 请求媒体字节。这样可以保留源站的分辨率、音频和 CDN 带宽，同时避免函数承担大体积视频流量。

## 先认识 BVID、分 P 与 CID

视频地址中的 `BVxxxxxxxxxx` 是 BVID，它标识一份投稿。例如：

```text
https://www.bilibili.com/video/BVxxxxxxxxxx
```

一份投稿可以有多个分 P。网页地址中的 `?p=2` 表示第二个分 P，但播放接口不使用 `p`，而使用该分 P 的 `cid`。因此，解析过程的第一步是从 BVID 找到 CID：

```text
GET https://api.bilibili.com/x/web-interface/view?bvid=BVxxxxxxxxxx
```

响应中的 `data.pages` 是分 P 列表。选择第 `p` 个元素即可得到 CID：

```json
{
  "data": {
    "title": "投稿标题",
    "owner": { "name": "投稿者", "mid": 12345 },
    "pages": [
      { "cid": 987654321, "page": 1, "part": "P1" },
      { "cid": 987654322, "page": 2, "part": "P2" }
    ]
  }
}
```

博客的 MV 数据只保存 BVID、分 P、封面、标题及分类。播放器在需要播放时查询资料接口，再用 `pages[p - 1].cid` 请求播放资料。标题和 `owner` 同时用于播放器顶部的“MV 视频来源”和“跳转到 B 站”按钮。

`cid` 通常比带签名的媒体 URL 稳定得多。本项目会缓存 BVID 对应的分 P 和投稿者资料，但不会把媒体地址作为长期静态数据保存。

## 播放页数据与播放接口

打开 B 站播放页后，浏览器会取得初始播放器数据；部分页面源码中还能看到 `window.__playinfo__` 一类的 JSON。这些数据适合观察播放器拿到了哪些字段，但不适合作为博客的固定解析手段：页面结构、首屏请求时机、账号状态和请求参数都可能变化。

后端使用的是播放器同类资料接口：

```text
GET https://api.bilibili.com/x/player/playurl
    ?bvid=BVxxxxxxxxxx
    &cid=987654321
    &fnval=4048
    &fnver=0
    &fourk=1
    &high_quality=1
    &platform=html5
```

其中：

| 参数 | 作用 |
| --- | --- |
| `bvid`、`cid` | 指定投稿和分 P。 |
| `fnval=4048` | 请求 DASH 播放资料。 |
| `fourk=1`、`high_quality=1` | 允许接口返回该账号实际可看的高画质。 |
| `platform=html5` | 取得适合网页 `<video>` 直接请求的资料。 |

代码不固定 `qn=127` 或其他最高画质编号。固定编号有时会被源站降为较低档位，且无法获知本次响应中其余可用档位。省略 `qn` 后，接口返回当前会话下的 `dash.video` 列表，画质菜单只显示该列表中确实存在的项目。

账号权限、视频本身上传的清晰度、投稿者设置和地区可用性都会影响结果。即使某个视频标题写有“4K”，本次 `playurl` 响应没有 4K 视频轨时，播放器就不会显示 4K。反过来，只要响应中有 1080P60、2K 或 4K 轨道，菜单就会生成对应选项。

## DASH、渐进式 MP4 与 HLS 的区别

### DASH：高画质常用形式

目前 B 站高画质播放资料通常使用 MPEG-DASH。响应的核心字段是：

```json
{
  "dash": {
    "duration": 238,
    "video": [
      {
        "id": 116,
        "baseUrl": "https://...视频轨...",
        "backupUrl": ["https://...备用视频轨..."],
        "codecs": "avc1.640032",
        "width": 1920,
        "height": 1080,
        "bandwidth": 8500000,
        "segment_base": {
          "initialization": "0-1100",
          "index_range": "1101-4200"
        }
      }
    ],
    "audio": [
      {
        "baseUrl": "https://...音频轨...",
        "codecs": "mp4a.40.2"
      }
    ]
  }
}
```

视频和音频是两条独立的 fragmented MP4 轨。将 `dash.video[0].baseUrl` 直接交给 `<video src>`，通常只会得到无声画面；正确做法是向播放器提供同时包含视频轨和音频轨的 MPD 清单。播放器先读取 `Initialization` 与 `indexRange`，再按播放位置请求所需字节范围。

### 渐进式 MP4：首帧较快的补充来源

`playurl` 也可能返回 `durl`。它表示可直接装入 `<video>` 的渐进式 MP4 数据，前端不需要自行组合音频。低、中画质在部分网络中用这种方式取得首帧较快，但不适合作为所有视频的唯一方案：某些档位没有 `durl`，有些结果会被降档，还有些视频由多个分段组成。

项目的 `/api/fast` 只接受“返回画质等于请求画质、只有一个分段、分段中有 URL”的结果。不满足时明确返回失败，前端保留同档 DASH，不会把用户选择的 1080P60、2K 或 4K 静默换成 720P。

### HLS：以 M3U8 描述分段

HLS 使用 `.m3u8` 播放列表描述媒体分段。它的播放列表包含若干片段 URL，浏览器或 hls.js 按顺序下载。HLS 与 DASH 都是自适应媒体格式，但清单结构和播放器支持方式不同。本项目当前以 DASH 为主、以单段 MP4 为快速备选，不依赖 HLS；如果后续接口返回 HLS，应将 `.m3u8` 作为独立 source 交给支持 HLS 的播放器，而不是把它当成 MP4。

## 从实际轨道建立画质菜单

`support_formats` 给出 B 站对质量编号的显示文字，`dash.video` 才是本次真正可播放的轨道。两者需要结合使用：

1. 从 `dash.video` 收集出现过的 `id`，这就是可播放的画质编号。
2. 在同一画质下选择可用视频轨；当前实现优先 AVC，然后选择码率更高的轨道。AVC 对浏览器和 Video.js/VHS 的支持最稳定，AV1、HEVC 仍会在没有 AVC 时保留。
3. 从 `support_formats` 读取 `display_desc` 与 `superscript`，生成如 `1080P60`、`4K`、HDR 的名称。
4. 选择一条 `mp4a` 音频轨，并为每个视频轨生成一个 MPD。

常见编号可作为排查参考，但不应用它们推断某个视频一定有该画质：

| 质量编号 | 常见显示名称 |
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

后端返回给前端的画质项类似：

```json
{
  "code": "dash-116",
  "qn": 116,
  "label": "1080P60",
  "resolution": "1920×1080",
  "type": "application/dash+xml",
  "manifest": "<?xml version=\"1.0\" ...>",
  "candidates": {
    "video": ["https://...备用视频地址..."],
    "audio": ["https://...备用音频地址..."]
  },
  "fastProgressive": true
}
```

这里的 `candidates` 是源站提供的备用 CDN 地址。它们不是新的清晰度，而是同一媒体轨可替换的下载地址。

## 生成最小 MPD

对于一组视频轨与音频轨，可以构造一个 ISO-BMFF on-demand MPD：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011">
  <Period>
    <AdaptationSet mimeType="video/mp4" contentType="video">
      <Representation id="video-116" codecs="avc1.640032"
                      width="1920" height="1080" bandwidth="8500000">
        <BaseURL>https://...视频轨...</BaseURL>
        <SegmentBase indexRange="1101-4200">
          <Initialization range="0-1100"/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4" contentType="audio">
      <Representation id="audio" codecs="mp4a.40.2" bandwidth="192000">
        <BaseURL>https://...音频轨...</BaseURL>
        <SegmentBase indexRange="...">
          <Initialization range="..."/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```

`BaseURL` 必须是绝对地址，`SegmentBase` 的范围直接来自 `playurl` 响应。若缺少音频 `AdaptationSet`，视频会静音；若把 MPD 误标为 `video/mp4`，播放器会把它当成单文件 MP4。

前端无需把清单写进静态文件。当前代码将 MPD 编码为 `data:` URL，再设置给 Video.js/VHS：

```javascript
const mpdUrl = `data:application/dash+xml;charset=utf-8,${encodeURIComponent(source.manifest)}`;

player.src({
  src: mpdUrl,
  type: 'application/dash+xml',
});
```

MPD 中的媒体 URL 仍是绝对地址，因此 VHS 会直接请求 B 站 CDN。使用 `data:` URL 也避免了生成临时 MPD 文件和额外一次清单请求。

## 让页面播放更稳定

媒体地址带有时效签名，网络节点也会随请求而变化。播放器不能把一次失败记成“该视频永久不可用”，也不能长期缓存 `/api/resolve` 的结果。当前页面采用以下恢复顺序：

1. 重装同一个 DASH 清单，并给 `data:` URL 增加一个仅用于本次重试的片段标记，使 Video.js/VHS 新建加载器。
2. 对低、中画质请求同档单段 MP4；先用 `Range: bytes=0-0` 验证主地址，再依次验证 `backup_url`。
3. 将 DASH 视频轨与音频轨替换为源站返回的备用 CDN 地址。
4. 重新请求 `/api/resolve?refresh=...`，取得新的签名和新的候选地址。

请求阶段会对网络中断及 408、425、429、5xx 进行带随机扰动的指数退避。任何一次解析或媒体失败都不会写入页面缓存。用户点击播放时，如果画质列表尚在读取，前端先记录播放意图，source 准备完毕后再开始播放，避免播放器停在 `0:00`。

切换画质时，播放器保留当前播放时间，再给 Video.js 设置新 source。这样从 720P 切到 1080P60，或从 4K 切回 1080P，不需要回到视频开头。默认选择顺序为：用户上次选择的画质、720P、当前视频可用的最高画质。

## 登录会话、高画质与安全存放

1080P60、2K、4K、HDR 等项目是否返回，取决于调用 `playurl` 的账号状态。本项目使用 `tools/bili_qr_login_gui.py` 通过扫码取得登录 Cookie，由 Function 保存；浏览器只得到短时媒体地址、画质资料和投稿者信息，不得到 Cookie。

Function 在 Netlify Blobs 保存前用 AES-256-GCM 加密会话，保存时间为 30 天。扫码登录、会话导入、状态查询和退出接口均在 `/api/admin/*` 下，并通过 `BILI_PARSER_ADMIN_TOKEN` 验证。部署时需要配置：

| 变量 | 用途 |
| --- | --- |
| `BILI_SESSION_ENCRYPTION_KEY` | 生成 AES-256-GCM 密钥，保护保存在 Netlify Blobs 中的会话。 |
| `BILI_PARSER_ADMIN_TOKEN` | 调用扫码登录、会话导入和退出接口的 Bearer Token。 |
| `BILI_ALLOWED_ORIGIN` | 可选的允许来源；前端和 Function 同域部署时可不设置。 |

高画质菜单只以接口返回的实际轨道为准。检查某个视频是否真的有 1080P60 或 4K 时，查看 `/api/resolve` 返回的 `sources`，不要只看标题或投稿页的文案。

## CORS、Referer 与静态部署

前端、解析接口和博客页面放在同一个 Netlify 项目中，浏览器访问 `/api/resolve` 时是同源请求；Function 仍会针对 `BILI_ALLOWED_ORIGIN` 返回 CORS 响应头，方便本地调试或独立前端接入。

媒体文件来自 B 站 CDN，属于跨域请求。播放器以 `referrerpolicy="no-referrer"` 加载媒体，解析接口请求 `platform=html5`，以取得可由网页播放器直接加载的资料。不要假定任意 CDN 地址都能跨域播放：某个节点的响应头、网络位置或短时签名变化时，应该走备用 URL 与重新解析，而不是把失败地址写入永久数据。

Function 不代理视频字节，只返回 JSON 和 MPD 文本；大流量媒体请求绕过 Netlify Function。这一点对静态部署尤其重要：构建产物仍是普通的 Docusaurus 页面，只有用户打开 MV 时才调用 Function，不会把视频体积带入网站构建或 Git 仓库。

项目对解析范围做了数据目录限制：`scripts/build-bili-parser-catalog.mjs` 从 `static/data/mv_bilibili.*.jsonl` 生成 `netlify/functions/catalog.mjs`，`/api/resolve` 只接受目录中已有的 BVID 与分 P。这样 MV 数据、播放器和解析服务始终使用同一批视频记录。

## 本地调试与主要文件

本地可以启动与线上接口结构一致的解析服务：

```bash
cd local-bili-parser
npm install
npm start
```

服务默认监听 `127.0.0.1:19180`，前端可请求 `http://127.0.0.1:19180/api`。它同样请求 `fnval=4048`，便于在不同账号或网络下查看实际可用画质。

| 文件 | 内容 |
| --- | --- |
| `netlify/functions/bili.mjs` | B 站资料查询、登录会话、DASH MPD、快速 MP4 和恢复所需数据。 |
| `netlify/functions/catalog.mjs` | 由 MV 数据生成的 BVID 与分 P 目录。 |
| `static/custom/js/aplayer.js` | MV 卡片、Video.js 初始化、画质菜单、预检和恢复流程。 |
| `local-bili-parser/server.mjs` | 本机调试解析服务。 |
| `tools/bili_qr_login_gui.py` | B 站扫码登录图形工具。 |

这套结构的关键是把长期稳定的数据与短时数据分开保存：BVID、分 P、封面和分类留在静态 JSONL；CID 可以短期缓存；媒体 URL 每次播放时重新取得。前端依据真实视频轨生成选择项，并在下载地址失效时尝试备用节点和新解析结果，因此能同时处理 720P、1080P60、2K、4K 等不同来源条件。
