import React from 'react';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import './music.css';

const MusicIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h6V3h-8Z"/></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg>;
const GridIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm10 0h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM4 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm10 0h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z"/></svg>;
const ListIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h2v2H4V5Zm4 0h12v2H8V5ZM4 11h2v2H4v-2Zm4 0h12v2H8v-2ZM4 17h2v2H4v-2Zm4 0h12v2H8v-2Z"/></svg>;

function Page(): JSX.Element {
  return <div className="music-page">
    <header className="music-hero">
      <div className="music-hero__art"><MusicIcon /><span className="music-hero__pulse" /></div>
      <div className="music-hero__copy">
        <span className="music-eyebrow">PERSONAL MUSIC LIBRARY</span>
        <h1>音乐收藏</h1>
        <p>戴上耳机，从嘈杂中暂时抽离。这里收藏了我喜欢的 ACG、日语、纯音乐与更多声音。</p>
        <div className="music-hero__meta">
          <span><b id="music-library-count">—</b> 首曲目</span><i />
          <span>HQ / SQ / Hi-Res</span>
        </div>
      </div>
    </header>

    <div className="music-notice"><span>i</span><p>本站音乐为本人自购或来自互联网，仅供个人欣赏。</p></div>

    <section className="music-section music-playlists">
      <div className="music-section__heading">
        <div><span className="music-eyebrow">YOUR MOODS</span><h2>选择歌单</h2></div>
        <div className="playlist-heading-tools">
          <div className="playlist-sort-controls" role="group" aria-label="歌单排序">
            <span>排序</span>
            <button type="button" data-playlist-sort="default">默认</button>
            <button type="button" data-playlist-sort="name">按名称</button>
            <button type="button" data-playlist-sort="id">按 ID</button>
          </div>
          <p>使用两侧按钮浏览分类</p>
        </div>
      </div>
      <div id="aplayer_list_parent"><div id="aplayer_list" /></div>
    </section>

    <section className="music-section music-library">
      <div className="music-section__heading music-library__heading">
        <div><span className="music-eyebrow">TRACKS</span><h2 id="current_playlist_name">默认歌单</h2></div>
        <div className="music-library-heading-tools">
          <div className="music-track-sort-controls" role="group" aria-label="歌曲列表排序">
            <span>排序</span>
            <button type="button" data-track-sort="default">默认</button>
            <button type="button" data-track-sort="name">按名称</button>
            <button type="button" data-track-sort="id">按 ID</button>
          </div>
          <span className="music-result-count"><b id="music-list-result-count">—</b> 首</span>
        </div>
      </div>

      <div className="music-library__toolbar">
        <button id="ap_list0" className="sytle-button-current-list"><span>✓</span> 当前播放列表</button>
        <div id="ap_list_button"><div id="ap_list_button_sub">
          <button id="ap_list_remove">清空</button>
          <button id="ap_list_select_all">全选</button>
          <button id="ap_list_random_select">随机选几首</button>
          <label id="ap_list_display_limit_label" htmlFor="ap_list_display_limit">显示上限
            <select id="ap_list_display_limit" defaultValue="12">
              <option value="8">8 项</option><option value="12">12 项</option><option value="20">20 项</option><option value="30">30 项</option><option value="0">全部</option>
            </select>
          </label>
        </div></div>
      </div>

      <div className="music-track-head"><span>#</span><span>歌曲</span><span>操作</span></div>
      <div id="aplayer_list_active" />
      <p className="music-library__hint">可通过上方设置调整列表显示高度；点击曲目即可加入或移出播放列表。</p>
    </section>

    <section className="music-section music-player-section">
      <div className="music-section__heading">
        <div><span className="music-eyebrow">NOW PLAYING</span><h2>音乐播放器</h2></div>
        <div id="aplayer_qua" className="music-quality-switch">
          <button id="ap_qua1" className="sytle-qua-button">SQ &amp; Hi-Res</button>
          <button id="ap_qua2" className="sytle-qua-button">HQ</button>
        </div>
      </div>
      <div className="music-player-note"><MusicIcon /><p>默认使用 HQ 以获得更流畅的体验。切换至 SQ / Hi-Res 后，播放和拖动进度可能更依赖网络状况。</p></div>
      <div className="music-player-shell">
        <div className="music-player-shell__glow" aria-hidden="true" />
        <div id="aplayer0"><div id="aplayer0-button"><button id="ap_load" className="sytle-ap-button">正在准备播放器</button></div></div>
        <div id="aplayer_ctr" aria-label="播放控制" />
      </div>
    </section>

    <section className="music-section music-mv-section">
      <div className="music-section__heading">
        <div><span className="music-eyebrow">PROJECT SEKAI VIDEO LIBRARY</span><h2>プロセカ MV</h2></div>
        <p>按组合筛选，选择想看的歌</p>
      </div>

      <div className="mv-source-banner">
        <div className="mv-source-banner__mark">B</div>
        <div className="mv-source-banner__copy">
          <strong>MV 视频来源</strong>
          <span>视频来自 B 站 UP 主「Project_SEKAI资讯站」</span>
        </div>
        <a id="mv-source-bili-link" className="mv-source-banner__link" href="https://space.bilibili.com/13148307/lists/1547037?type=season" target="_blank" rel="noopener noreferrer">跳转到 B 站</a>
      </div>

      <div id="mv-player-stage" className="mv-player-stage" hidden />

      <div className="mv-toolbar">
        <label className="mv-search" htmlFor="mv-search-input">
          <SearchIcon />
          <input id="mv-search-input" type="search" placeholder="搜索歌名或组合" autoComplete="off" />
        </label>
        <div className="mv-view-switch" role="group" aria-label="MV 显示方式">
          <button id="mv-view-grid" type="button" aria-label="卡片视图" aria-pressed="true"><GridIcon /></button>
          <button id="mv-view-list" type="button" aria-label="列表视图" aria-pressed="false"><ListIcon /></button>
        </div>
      </div>

      <div id="mv-group-filters" className="mv-group-filters" aria-label="按组合筛选" />
      <div className="mv-result-bar">
        <span><b id="mv-result-count">—</b> 部视频</span>
        <span id="mv-current-filter">全部组合</span>
      </div>
      <div id="mv_player_div" />
    </section>
  </div>;
}

export default function Music(): JSX.Element {
  return <><PageMetadata title="音乐" description="Yusenの音乐库" /><Layout><main className="container margin-vert--lg"><Page /></main></Layout></>;
}
