import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {AdminSessionProvider} from '@site/src/components/AdminSession';

import styles from './styles.module.css';

export default function Root({children}: {children: ReactNode}) {
  return (
    <AdminSessionProvider>
      {children}
      <div className={styles.musicPlayerHome} id="music-player-home">
        <aside className={styles.miniPlayer} id="music-mini-player" aria-label="音乐播放控制" hidden>
          <Link to="/music#music-player-page-mount" className={styles.miniCover} id="music-mini-cover" aria-label="打开音乐页面播放器" />
          <div className={styles.miniTrack}>
            <Link to="/music#music-player-page-mount" className={styles.miniTitle} id="music-mini-title">未选择歌曲</Link>
            <span className={styles.miniArtist} id="music-mini-artist">音乐收藏</span>
            <div className={styles.miniProgressRow}>
              <input className={styles.miniProgress} id="music-mini-progress" type="range" min="0" max="1000" defaultValue="0" aria-label="播放进度" />
              <span className={styles.miniTime} id="music-mini-time">00:00 / 00:00</span>
            </div>
          </div>
          <div className={styles.miniControls} role="group" aria-label="音乐播放控制">
            <button className={styles.miniButton} id="music-mini-previous" type="button" aria-label="上一首" title="上一首">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 6v12L8 12z" /></svg>
            </button>
            <button className={`${styles.miniButton} ${styles.miniPlay}`} id="music-mini-toggle" type="button" aria-label="播放" title="播放">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path id="music-mini-play-icon" d="M8 5v14l11-7z" /></svg>
            </button>
            <button className={styles.miniButton} id="music-mini-next" type="button" aria-label="下一首" title="下一首">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M5 6v12l11-6z" /></svg>
            </button>
            <button className={`${styles.miniButton} ${styles.miniCollapse}`} id="music-mini-collapse" type="button" aria-label="收缩到侧边栏" aria-expanded="true" title="收缩到侧边栏">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path id="music-mini-collapse-icon" d="m14 6-6 6 6 6" /></svg>
            </button>
          </div>
          <div className={styles.miniTools} role="group" aria-label="其他播放器控制">
            <button className={styles.miniToolButton} id="music-mini-lyric" type="button" aria-label="显示歌词" aria-pressed="true" title="显示或隐藏歌词">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 10h12M4 14h10M4 18h7" /></svg><span id="music-mini-lyric-label">歌词</span>
            </button>
            <button className={styles.miniToolButton} id="music-mini-order" type="button" aria-label="顺序播放" aria-pressed="false" title="切换顺序或随机播放">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h3.5c2 0 3.1 1.2 4.3 3l4.4 6.5c1 1.5 2.2 2.5 4.3 2.5H22m-3-3 3 3-3 3M4 18h3.5c2 0 3.2-1.1 4.3-2.6M16 6h6m-3-3 3 3-3 3" /></svg><span id="music-mini-order-label">顺序</span>
            </button>
            <button className={styles.miniToolButton} id="music-mini-loop" type="button" aria-label="列表循环" aria-pressed="false" title="切换循环模式">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></svg><span id="music-mini-loop-label">循环</span>
            </button>
            <button className={styles.miniToolButton} id="music-mini-queue-toggle" type="button" aria-label="展开队列" aria-expanded="false" title="展开队列">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h14M4 12h14M4 18h9M19 16v5m-2.5-2.5h5" /></svg><span>队列</span>
            </button>
            <label className={styles.miniVolumeLabel} aria-label="播放器音量">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Zm13-2a6 6 0 0 1 0 8m2-11a10 10 0 0 1 0 14" /></svg>
              <input className={styles.miniVolume} id="music-mini-volume" type="range" min="0" max="100" step="1" defaultValue="50" aria-label="播放器音量" title="播放器音量" />
            </label>
          </div>
          <section className={styles.miniQueue} id="music-mini-queue" aria-label="播放列表" hidden>
            <header className={styles.miniQueueHeading}>
              <strong>播放列表</strong>
              <span id="music-mini-queue-count">0 首</span>
              <button className={styles.miniQueueClose} id="music-mini-queue-close" type="button" aria-label="收起播放列表" title="收起播放列表">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </header>
            <ol className={styles.miniQueueList} id="music-mini-queue-list" />
          </section>
        </aside>
      </div>
    </AdminSessionProvider>
  );
}
