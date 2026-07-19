# 音乐资料整理工具

`music_library_gui.py` 用于本地整理音乐资源，并生成音乐页使用的 JSONL 资料。它替代旧版 `music.py` 中固定 Windows 路径、手工拼接 JSON 的处理方式。

## 安装与启动

系统需要提供 `ffmpeg` 和 `git`；图形界面使用 PyQt6，音频标签读取使用 `mutagen`。

```bash
python3 -m venv .venv-music-library
.venv-music-library/bin/python -m pip install -r tools/requirements-music-library-gui.txt
.venv-music-library/bin/python tools/music_library_gui.py
```

## 操作顺序

1. 选择包含 FLAC、WAV、M4A、MP3 等文件的音乐源目录。
2. 选择 MP3 资源仓库；如需保存原始高码率文件，再选择高音质资源仓库。
3. 填写两个资源仓库对应的公开原始文件 URL 前缀，例如 GitHub Raw 或自建静态文件域名。
4. 点击“扫描音乐”，在表格中复核歌名、歌手和专辑；选中条目后可以修改输出元数据，并在“歌单标签”中勾选标签后批量写入所选曲目。
5. 点击“整理并导出（所选）”。该操作会将音频编码为 320 kbps MP3、复制同目录的封面和 LRC 文件，并合并写入 `music_hq.0.jsonl` 与 `music_sq.0.jsonl`。
6. 在“资源仓库 Git”页面查看状态、提交并推送资源文件。博客资料文件仍位于博客仓库，需要按正常方式提交。

不选表格项目时，转换与导出会处理全部已扫描曲目。默认保留同名的已存在资源；勾选“覆盖已有资源文件”后才会替换它们。源目录始终只读，工具不会重命名或删除原始音乐文件。

## JSONL 合并规则

- 使用“歌名 + 歌手”寻找已有曲目；命中后保留原有 `mid`，并更新 URL、歌单和资料字段。扫描时会读取已有资料中的歌单标签。
- 新曲目分配当前最大 `mid + 1`，HQ 与 SQ 使用相同的 `mid`。
- 未选中的既有 JSONL 记录不会被删除。
- 未设置高音质目录或 URL 时，SQ 记录会暂时使用 MP3 地址，便于后续补充高码率资源。

## 批量导入新下载目录

`import_new_music.py` 以某个已导入目录的文件日期为基准，选择同一层级中较新的目录。它将 320 kbps MP3、原始音频和封面统一写入一个资源仓库；HQ 记录使用 MP3，SQ 记录使用原始文件。当前站点资源使用 Hugging Face 的国内访问镜像地址。

先预览目录、曲目数和分类：

```bash
python3 tools/import_new_music.py --report /tmp/music-import-preview.json
```

确认后执行资源整理与 JSONL 写入：

```bash
python3 tools/import_new_music.py --apply --report /tmp/music-import-result.json
```

需要由脚本提交资源和博客资料时，再追加 `--push-assets --push-blog`。脚本会保留已有资源文件；同名同歌手的重复曲目只保留第一份，名称包含 `Off Vocal` 的伴奏版本不会导入。内嵌封面会导出到曲目所在目录的 `cover.jpg` 或 `cover.png`，过长的文件名会自动缩短并附加固定摘要，避免文件系统拒绝创建文件。

当前基础分类规则如下：

- `Girls und Panzer` 系列使用 `Girls und Panzer Music Collection`。
- 《秽翼的尤斯蒂娅》使用 `秽翼的尤斯蒂娅OST`。
- `secretgarden` 与《色彩》分别归入 `ChouCho`、`ヰ世界情緒`。
- 其他 OST、OP、ED 使用既有 `ACG` 分类。

## 批量下载歌词

`download_music_lyrics.py` 调用本机 `LDDC` 的自动匹配功能，依次查询 QQ 音乐、酷狗、网易云与 Lrclib，保存标准逐行 LRC 到 MP3 同目录，并将成功结果写回 HQ、SQ 资料。脚本会跳过已有歌词、器乐、独白和明显的 off vocal 曲目；网络失败不会中断后续曲目。

LDDC 使用 PySide6。若系统环境未安装其依赖，可建立独立运行环境：

```bash
uv venv /tmp/lddc-runtime --python python3
uv pip install --python /tmp/lddc-runtime/bin/python -r /media/6/旧项目/网站/LDDC/requirements.txt
uv pip install --python /tmp/lddc-runtime/bin/python 'PyQt6>=6.6,<7'
```

先以一首歌测试匹配，再处理全部曲目：

```bash
/tmp/lddc-runtime/bin/python tools/download_music_lyrics.py --limit 1 --apply
/tmp/lddc-runtime/bin/python tools/download_music_lyrics.py --apply --report /tmp/music-lyrics-result.json
```

## 资料校验

整理前后可执行以下命令检查 JSONL 结构、重复 ID、歌单引用、HQ/SQ 对应关系和 MV 资料：

```bash
python3 tools/validate_media_data.py
# 或：npm run validate:media-data
```

需要检查远程资源可访问性时：

```bash
python3 tools/validate_media_data.py --check-urls --workers 12 --report /tmp/media-data-report.json
```

远程服务临时不可访问默认记为警告；加入 `--strict-urls` 会将其视为错误。
