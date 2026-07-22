import React, {useEffect, useMemo, useState} from 'react';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import styles from './settings.module.css';

const STORAGE_KEY = 'yusen-effect-settings-v1';

type EffectKey =
  | 'live2d'
  | 'sakura'
  | 'bubbles'
  | 'stars'
  | 'particles'
  | 'fireworks';

type FrameRate = 0 | 15 | 24 | 30 | 45 | 60;
type Live2DFrameRate = -1 | FrameRate;
type LowPowerTimeout = 0 | 30 | 60 | 180 | 300 | 600;
type Complexity = 'low' | 'balanced' | 'high';
type EffectSettings = Record<EffectKey, boolean> & {
  enabled: boolean;
  blur: boolean;
  frameRate: FrameRate;
  live2dFrameRate: Live2DFrameRate;
  lowPowerTimeout: LowPowerTimeout;
  complexity: Complexity;
};

const FRAME_RATE_OPTIONS: Array<{value: FrameRate; label: string}> = [
  {value: 0, label: '跟随显示器（垂直同步）'},
  {value: 60, label: '60 FPS'},
  {value: 45, label: '45 FPS'},
  {value: 30, label: '30 FPS'},
  {value: 24, label: '24 FPS'},
  {value: 15, label: '15 FPS'},
];

const LIVE2D_FRAME_RATE_OPTIONS: Array<{value: Live2DFrameRate; label: string}> = [
  {value: -1, label: '跟随特效帧率上限'},
  {value: 0, label: '跟随显示器（垂直同步）'},
  {value: 60, label: '60 FPS'},
  {value: 45, label: '45 FPS'},
  {value: 30, label: '30 FPS'},
  {value: 24, label: '24 FPS'},
  {value: 15, label: '15 FPS'},
];

const LOW_POWER_TIMEOUT_OPTIONS: Array<{value: LowPowerTimeout; label: string}> = [
  {value: 0, label: '不自动进入'},
  {value: 30, label: '30 秒'},
  {value: 60, label: '1 分钟'},
  {value: 180, label: '3 分钟'},
  {value: 300, label: '5 分钟'},
  {value: 600, label: '10 分钟'},
];

const COMPLEXITY_OPTIONS: Array<{value: Complexity; label: string; description: string}> = [
  {value: 'low', label: '轻量', description: '约一半粒子数量，适合低功耗设备。'},
  {value: 'balanced', label: '均衡', description: '保持当前默认的视觉密度。'},
  {value: 'high', label: '丰富', description: '提升背景粒子、星空与花瓣密度。'},
];

const DEFAULT_SETTINGS: EffectSettings = {
  enabled: true,
  live2d: true,
  sakura: true,
  bubbles: true,
  stars: true,
  particles: true,
  fireworks: true,
  blur: true,
  frameRate: 0,
  live2dFrameRate: -1,
  lowPowerTimeout: 0,
  complexity: 'balanced',
};

const EFFECTS: Array<{
  key: EffectKey;
  icon: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  impactLabel: string;
}> = [
  {
    key: 'live2d',
    icon: '✦',
    title: 'Live2D 看板娘',
    description: '页面右下角的可交互角色。使用官方 Cubism Web R5、延迟加载；可单独设置帧率上限。',
    impact: 'high',
    impactLabel: '较高性能影响',
  },
  {
    key: 'sakura',
    icon: '❀',
    title: '樱花飘落',
    description: '页面上层持续飘落的樱花花瓣。',
    impact: 'medium',
    impactLabel: '中等性能影响',
  },
  {
    key: 'bubbles',
    icon: '◌',
    title: '气泡背景',
    description: '首屏缓慢上升的蓝色气泡粒子。',
    impact: 'medium',
    impactLabel: '中等性能影响',
  },
  {
    key: 'stars',
    icon: '☄',
    title: '暗色流星',
    description: '黑夜模式下的星空与流星背景。',
    impact: 'medium',
    impactLabel: '中等性能影响',
  },
  {
    key: 'particles',
    icon: '⌘',
    title: '粒子连线',
    description: '跟随鼠标轻微移动的背景粒子网络。',
    impact: 'high',
    impactLabel: '较高性能影响',
  },
  {
    key: 'fireworks',
    icon: '✷',
    title: '点击烟花',
    description: '点击页面空白区域时出现的短暂烟花效果。',
    impact: 'low',
    impactLabel: '低性能影响',
  },
];

function normalizeSettings(value: Partial<EffectSettings> | null | undefined): EffectSettings {
  const frameRate = Number(value?.frameRate);
  const live2dFrameRate = Number(value?.live2dFrameRate);
  const lowPowerTimeout = Number(value?.lowPowerTimeout);
  const complexity = COMPLEXITY_OPTIONS.some((option) => option.value === value?.complexity)
    ? value.complexity as Complexity
    : DEFAULT_SETTINGS.complexity;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    blur: value?.blur !== false,
    frameRate: FRAME_RATE_OPTIONS.some((option) => option.value === frameRate)
      ? frameRate as FrameRate
      : DEFAULT_SETTINGS.frameRate,
    live2dFrameRate: LIVE2D_FRAME_RATE_OPTIONS.some((option) => option.value === live2dFrameRate)
      ? live2dFrameRate as Live2DFrameRate
      : DEFAULT_SETTINGS.live2dFrameRate,
    lowPowerTimeout: LOW_POWER_TIMEOUT_OPTIONS.some((option) => option.value === lowPowerTimeout)
      ? lowPowerTimeout as LowPowerTimeout
      : DEFAULT_SETTINGS.lowPowerTimeout,
    complexity,
  };
}

function readSavedSettings(): EffectSettings {
  try {
    return normalizeSettings(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return {...DEFAULT_SETTINGS};
  }
}

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<EffectSettings>(DEFAULT_SETTINGS);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(DEFAULT_SETTINGS));
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const saved = readSavedSettings();
    setSettings(saved);
    setSavedSnapshot(JSON.stringify(saved));
    setReady(true);

    const syncSettings = (event: Event) => {
      const detail = (event as CustomEvent<Partial<EffectSettings>>).detail;
      const synchronized = detail ? normalizeSettings(detail) : readSavedSettings();
      setSettings((current) => ({...current, live2d: synchronized.live2d}));
      setSavedSnapshot(JSON.stringify(synchronized));
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) syncSettings(event);
    };
    window.addEventListener('yusen:effects-settings-change', syncSettings);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener('yusen:effects-settings-change', syncSettings);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);

  const enabledCount = useMemo(
    () => settings.enabled ? EFFECTS.filter((effect) => settings[effect.key]).length : 0,
    [settings],
  );
  const dirty = ready && JSON.stringify(settings) !== savedSnapshot;

  function toggle(key: EffectKey | 'enabled' | 'blur') {
    setSettings((current) => ({...current, [key]: !current[key]}));
  }

  function setFrameRate(frameRate: FrameRate) {
    setSettings((current) => ({...current, frameRate}));
  }

  function setLive2DFrameRate(live2dFrameRate: Live2DFrameRate) {
    setSettings((current) => ({...current, live2dFrameRate}));
  }

  function setLowPowerTimeout(lowPowerTimeout: LowPowerTimeout) {
    setSettings((current) => ({...current, lowPowerTimeout}));
  }

  function setComplexity(complexity: Complexity) {
    setSettings((current) => ({...current, complexity}));
  }

  function saveAndApply() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('yusen:effects-settings-change', {detail: settings}));
    setApplying(true);
    window.setTimeout(() => window.location.reload(), 350);
  }

  function usePerformancePreset() {
    setSettings({
      enabled: true,
      live2d: false,
      sakura: false,
      bubbles: false,
      stars: true,
      particles: false,
      fireworks: true,
      blur: false,
      frameRate: 30,
      live2dFrameRate: -1,
      lowPowerTimeout: 60,
      complexity: 'low',
    });
  }

  return (
    <>
      <PageMetadata title="显示设置" description="自定义博客的页面特效与 Live2D 显示" />
      <Layout>
        <main className={styles.page}>
          <header className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>APPEARANCE &amp; PERFORMANCE</span>
              <h1>显示设置</h1>
              <p>按照自己的设备性能和喜好选择页面特效。关闭后，对应脚本将不再加载。</p>
            </div>
            <div className={styles.heroStatus} aria-live="polite">
              <strong>{ready ? enabledCount : '—'}</strong>
              <span>/ {EFFECTS.length} 项特效已开启</span>
            </div>
          </header>

          <section className={styles.masterCard}>
            <div className={styles.masterIcon} aria-hidden="true">◐</div>
            <div className={styles.masterCopy}>
              <span className={styles.sectionLabel}>GLOBAL SWITCH</span>
              <h2>页面特效总开关</h2>
              <p>一次关闭所有视觉特效，各项单独选择会被保留。</p>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={ready && settings.enabled}
                onChange={() => toggle('enabled')}
                disabled={!ready}
                aria-label="页面特效总开关"
              />
              <span aria-hidden="true" />
            </label>
          </section>

          <section className={styles.frameRateCard}>
            <div className={styles.frameRateIcon} aria-hidden="true">⌁</div>
            <div className={styles.frameRateCopy}>
              <span className={styles.sectionLabel}>FRAME RATE</span>
              <h2>特效帧率上限</h2>
              <p>限制动态背景、粒子、烟花和看板娘的渲染频率。默认跟随显示器，不额外节流。</p>
            </div>
            <label className={styles.frameRateSelect}>
              <span>当前上限</span>
              <select
                value={settings.frameRate}
                onChange={(event) => setFrameRate(Number(event.target.value) as FrameRate)}
                disabled={!ready}
                aria-label="特效帧率上限">
                {FRAME_RATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.frameRateCard}>
            <div className={styles.frameRateIcon} aria-hidden="true">✧</div>
            <div className={styles.frameRateCopy}>
              <span className={styles.sectionLabel}>EFFECT DENSITY</span>
              <h2>特效复杂度</h2>
              <p>控制樱花、气泡、星空和粒子连线的数量；不会在滚动时临时改变画面复杂度。</p>
            </div>
            <label className={styles.frameRateSelect}>
              <span>当前密度</span>
              <select
                value={settings.complexity}
                onChange={(event) => setComplexity(event.target.value as Complexity)}
                disabled={!ready}
                aria-label="特效复杂度">
                {COMPLEXITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}：{option.description}</option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.frameRateCard}>
            <div className={styles.frameRateIcon} aria-hidden="true">◔</div>
            <div className={styles.frameRateCopy}>
              <span className={styles.sectionLabel}>LOW POWER TIMEOUT</span>
              <h2>低功耗模式超时</h2>
              <p>无交互达到指定时间后，所有已开启特效固定限制为 15 FPS；再次操作页面会立即恢复各自的帧率设置。</p>
            </div>
            <label className={styles.frameRateSelect}>
              <span>无交互后</span>
              <select
                value={settings.lowPowerTimeout}
                onChange={(event) => setLowPowerTimeout(Number(event.target.value) as LowPowerTimeout)}
                disabled={!ready}
                aria-label="低功耗模式超时">
                {LOW_POWER_TIMEOUT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.frameRateCard}>
            <div className={styles.frameRateIcon} aria-hidden="true">◒</div>
            <div className={styles.frameRateCopy}>
              <span className={styles.sectionLabel}>LIVE2D FRAME RATE</span>
              <h2>看板娘帧率上限</h2>
              <p>可单独限制看板娘的渲染频率；“跟随特效帧率上限”使用上方设置。</p>
            </div>
            <label className={styles.frameRateSelect}>
              <span>当前上限</span>
              <select
                value={settings.live2dFrameRate}
                onChange={(event) => setLive2DFrameRate(Number(event.target.value) as Live2DFrameRate)}
                disabled={!ready}
                aria-label="看板娘帧率上限">
                {LIVE2D_FRAME_RATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.frameRateCard}>
            <div className={styles.frameRateIcon} aria-hidden="true">◌</div>
            <div className={styles.frameRateCopy}>
              <span className={styles.sectionLabel}>GLASS EFFECT</span>
              <h2>半透明模糊</h2>
              <p>控制半透明卡片、浮动面板与视频控件的背景模糊。关闭后保留透明层与配色，可降低图层合成开销。</p>
            </div>
            <label className={`${styles.frameRateSelect} ${styles.blurToggle}`}>
              <span>{ready && settings.blur ? '已开启' : '已关闭'}</span>
              <span className={styles.switch}>
                <input
                  type="checkbox"
                  checked={ready && settings.blur}
                  onChange={() => toggle('blur')}
                  disabled={!ready}
                  aria-label={`半透明模糊${settings.blur ? '已开启' : '已关闭'}`}
                />
                <span aria-hidden="true" />
              </span>
            </label>
          </section>

          <section className={styles.effectsSection}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionLabel}>INDIVIDUAL EFFECTS</span>
                <h2>单项设置</h2>
              </div>
              {!ready
                ? <span className={styles.pausedBadge}>正在读取设置…</span>
                : !settings.enabled && <span className={styles.pausedBadge}>已由总开关暂停</span>}
            </div>

            <div className={styles.effectGrid}>
              {EFFECTS.map((effect) => (
                <article
                  key={effect.key}
                  data-effect={effect.key}
                  className={`${styles.effectCard} ${ready && settings[effect.key] ? styles.effectCardActive : ''} ${ready && !settings.enabled ? styles.effectCardPaused : ''}`}>
                  <div className={styles.effectTopline}>
                    <span className={styles.effectIcon} aria-hidden="true">{effect.icon}</span>
                    <span className={`${styles.impact} ${styles[effect.impact]}`}>{effect.impactLabel}</span>
                  </div>
                  <div className={styles.effectCopy}>
                    <h3>{effect.title}</h3>
                    <p>{effect.description}</p>
                  </div>
                  <div className={styles.effectFooter}>
                    <span>{!ready ? '读取中' : settings[effect.key] ? '已开启' : '已关闭'}</span>
                    <label
                      className={styles.switch}
                      data-waifu-toggle={effect.key === 'live2d' ? 'true' : undefined}>
                      <input
                        type="checkbox"
                        checked={ready && settings[effect.key]}
                        onChange={() => toggle(effect.key)}
                        disabled={!ready}
                        aria-label={`${effect.title}${settings[effect.key] ? '已开启' : '已关闭'}`}
                      />
                      <span aria-hidden="true" />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.actionPanel}>
            <div>
              <strong>{!ready ? '正在读取本地设置…' : dirty ? '有未保存的更改' : '设置已生效'}</strong>
              <span>设置仅保存在当前浏览器中，不会上传任何资料。</span>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={usePerformancePreset}>性能优先</button>
              <button type="button" className={styles.secondaryButton} onClick={() => setSettings({...DEFAULT_SETTINGS})}>恢复默认</button>
              <button type="button" className={styles.primaryButton} onClick={saveAndApply} disabled={!dirty || applying}>
                {applying ? '正在应用…' : '保存并应用'}
              </button>
            </div>
          </section>
        </main>
      </Layout>
    </>
  );
}
