/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 *
 * Site integration and adaptive render loop: Copyright 2026 Yusen.
 */

import { CubismFramework, Option } from '@framework/live2dcubismframework';
import { CubismLogError } from '@framework/utils/cubismdebug';
import * as LAppDefine from './lappdefine';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';

export interface RuntimePreferences {
  mouseTracking?: boolean;
  idleMotion?: boolean;
}

export let s_instance: LAppDelegate = null;

export class LAppDelegate {
  public static getInstance(): LAppDelegate {
    if (s_instance == null) s_instance = new LAppDelegate();
    return s_instance;
  }

  public static releaseInstance(): void {
    if (s_instance != null) s_instance.release();
    s_instance = null;
  }

  public initialize(
    canvas: HTMLCanvasElement,
    preferences: RuntimePreferences = {}
  ): boolean {
    if (!canvas || this._initialized) return this._initialized;

    this._canvas = canvas;
    this._mouseTrackingEnabled = preferences.mouseTracking !== false;
    this._idleMotionEnabled = preferences.idleMotion !== false;
    this.initializeCubism();

    const subdelegate = new LAppSubdelegate();
    if (!subdelegate.initialize(canvas)) {
      CubismLogError('Failed to initialize the Cubism WebGL2 renderer.');
      CubismFramework.dispose();
      return false;
    }

    this._subdelegates.push(subdelegate);
    if (subdelegate.isContextLost()) {
      CubismLogError('The Cubism WebGL2 context was lost during startup.');
      this.releaseSubdelegates();
      CubismFramework.dispose();
      return false;
    }

    this._initialized = true;
    this.initializeEventListeners();
    this.setMouseTrackingEnabled(this._mouseTrackingEnabled);
    this.setIdleMotionEnabled(this._idleMotionEnabled);
    this.updatePerformanceState();
    return true;
  }

  public run(): void {
    if (!this._initialized || this._running) return;
    this._running = true;
    this._lastRenderTime = performance.now();
    LAppPal.resetTime();
    this.scheduleFrame();
  }

  public release(): void {
    this._running = false;
    if (this._frameRequest) cancelAnimationFrame(this._frameRequest);
    this._frameRequest = 0;
    this._pointerMovePending = false;
    this.releaseEventListeners();
    this.releaseSubdelegates();
    if (this._initialized) CubismFramework.dispose();
    this._cubismOption = null;
    this._initialized = false;
  }

  public setMouseTrackingEnabled(enabled: boolean): void {
    this._mouseTrackingEnabled = !!enabled;
    window.clearTimeout(this._pointerResetTimer);
    this._pointerResetTimer = 0;
    const manager = this.getManager();
    manager?.setMouseTrackingEnabled(this._mouseTrackingEnabled);
    if (!this._mouseTrackingEnabled) manager?.onDrag(0, 0);
    this.markInteraction(800);
  }

  public setIdleMotionEnabled(enabled: boolean): void {
    this._idleMotionEnabled = !!enabled;
    this.getManager()?.setIdleMotionEnabled(this._idleMotionEnabled);
    this.markInteraction(1200);
  }

  public setRenderingEnabled(enabled: boolean): void {
    const nextEnabled = !!enabled;
    if (this._environmentEnabled === nextEnabled) return;
    this._environmentEnabled = nextEnabled;
    if (!nextEnabled) {
      if (this._frameRequest) cancelAnimationFrame(this._frameRequest);
      this._frameRequest = 0;
      this._pointerMovePending = false;
    } else {
      this._lastRenderTime = performance.now();
      this.resetFrameSample();
      this.scheduleFrame();
    }
    LAppPal.resetTime();
  }

  public markInteraction(duration = 3000): void {
    // 保留公开方法，供控制栏和动作逻辑调用；不再因交互状态改变刷新频率。
    void duration;
  }

  public getStatus(): Record<string, unknown> {
    const motion = this.getManager()?.getMotionStatus() || null;
    const targetFps = this.getTargetFps();
    return {
      renderer: 'Cubism Web SDK R5 / WebGL2',
      activeFps: this._activeFps,
      targetFps,
      frameRateLimit: this.getEffectFrameRateLimit(),
      mouseTracking: this._mouseTrackingEnabled,
      idleMotion: this._idleMotionEnabled,
      renderedFrames: this._renderedFrames,
      actualFps: Math.round(this._actualFps * 10) / 10,
      averageFrameCost: Math.round(this._averageFrameCost * 100) / 100,
      frameBudgetUse: Math.round(
        this._averageFrameCost / (1000 / targetFps) * 1000
      ) / 10,
      lowPowerProfile: this._lowPowerDevice,
      webgpuAvailable: !!(navigator as any).gpu,
      motion
    };
  }

  private initializeCubism(): void {
    LAppPal.resetTime();
    this._cubismOption.logFunction = LAppDefine.DebugLogEnable
      ? LAppPal.printMessage
      : (): void => undefined;
    this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel;
    CubismFramework.startUp(this._cubismOption);
    CubismFramework.initialize();
  }

  private getManager() {
    return this._subdelegates[0]?.getLive2DManager();
  }

  private canRender(): boolean {
    return this._environmentEnabled &&
      !document.hidden &&
      this._inViewport &&
      !this._scrolling;
  }

  private scheduleFrame(): void {
    if (
      !this._running ||
      !this._environmentEnabled ||
      this._frameRequest ||
      s_instance == null
    ) return;
    this._frameRequest = requestAnimationFrame(this.onAnimationFrame);
  }

  private onAnimationFrame = (timestamp: number): void => {
    this._frameRequest = 0;
    if (!this._running || s_instance == null) return;

    if (!this.canRender()) {
      this._lastRenderTime = timestamp;
      LAppPal.resetTime();
      this.scheduleFrame();
      return;
    }

    const targetFps = this.getTargetFps();
    const frameInterval = 1000 / targetFps;
    const elapsed = timestamp - this._lastRenderTime;
    if (elapsed + 0.5 >= frameInterval) {
      if (this._pointerMovePending) this.flushPointerMove();
      this._lastRenderTime = elapsed > frameInterval * 2
        ? timestamp
        : this._lastRenderTime + frameInterval;
      LAppPal.updateTime();

      const started = performance.now();
      for (let i = 0; i < this._subdelegates.length; i++) {
        this._subdelegates[i].update();
      }
      this.recordFrame(performance.now() - started);
    }
    this.scheduleFrame();
  };

  private isMoveMode(): boolean {
    return !!(window as any).YusenLive2DControls?.isMoveMode?.();
  }

  private onPointerBegan = (event: PointerEvent): void => {
    if (event.target !== this._canvas || this.isMoveMode()) return;
    this._pointerCaptured = true;
    this.markInteraction();
    for (const subdelegate of this._subdelegates) {
      subdelegate.onPointBegan(event.clientX, event.clientY);
    }
  };

  private onPointerMoved = (event: PointerEvent): void => {
    if (
      this.isMoveMode() ||
      !this._environmentEnabled ||
      document.hidden ||
      (!this._mouseTrackingEnabled && !this._pointerCaptured)
    ) return;
    this._pendingPointerX = event.clientX;
    this._pendingPointerY = event.clientY;
    this._pointerMovePending = true;
  };

  private flushPointerMove = (): void => {
    this._pointerMovePending = false;
    if (!this._environmentEnabled || document.hidden || this.isMoveMode()) return;
    const clientX = this._pendingPointerX;
    const clientY = this._pendingPointerY;
    for (const subdelegate of this._subdelegates) {
      subdelegate.onPointMoved(
        clientX,
        clientY,
        this._mouseTrackingEnabled
      );
    }
    if (this._mouseTrackingEnabled) {
      window.clearTimeout(this._pointerResetTimer);
      this._pointerResetTimer = window.setTimeout(() => {
        this._pointerResetTimer = 0;
        if (!this._mouseTrackingEnabled) return;
        this.getManager()?.onDrag(0, 0);
        this.markInteraction(1200);
      }, 5000);
    }
  };

  private onPointerEnded = (event: PointerEvent): void => {
    if (!this._pointerCaptured || this.isMoveMode()) return;
    if (this._pointerMovePending) this.flushPointerMove();
    this._pointerCaptured = false;
    this.markInteraction(4000);
    for (const subdelegate of this._subdelegates) {
      subdelegate.onPointEnded(event.clientX, event.clientY);
    }
  };

  private onPointerCancel = (event: PointerEvent): void => {
    if (!this._pointerCaptured) return;
    this._pointerCaptured = false;
    for (const subdelegate of this._subdelegates) {
      subdelegate.onTouchCancel(event.clientX, event.clientY);
    }
  };

  private onVisibilityChange = (): void => {
    LAppPal.resetTime();
    if (!document.hidden) {
      this.resetFrameSample();
      this.markInteraction(1000);
    }
  };

  private onScroll = (): void => {
    this._scrolling = true;
    window.clearTimeout(this._scrollTimer);
    this._scrollTimer = window.setTimeout(() => {
      this._scrolling = false;
      LAppPal.resetTime();
      this.resetFrameSample();
    }, 110);
  };

  private initializeEventListeners(): void {
    this._canvas.addEventListener('pointerdown', this.onPointerBegan, {
      passive: true
    });
    window.addEventListener('pointermove', this.onPointerMoved, { passive: true });
    window.addEventListener('pointerup', this.onPointerEnded, { passive: true });
    window.addEventListener('pointercancel', this.onPointerCancel, {
      passive: true
    });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('scroll', this.onScroll, { passive: true });

    if ('IntersectionObserver' in window) {
      this._intersectionObserver = new IntersectionObserver(entries => {
        this._inViewport = entries[0]?.isIntersecting !== false;
        LAppPal.resetTime();
      });
      this._intersectionObserver.observe(this._canvas);
    }
  }

  private releaseEventListeners(): void {
    this._canvas?.removeEventListener('pointerdown', this.onPointerBegan);
    window.removeEventListener('pointermove', this.onPointerMoved);
    window.removeEventListener('pointerup', this.onPointerEnded);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('scroll', this.onScroll);
    this._intersectionObserver?.disconnect();
    this._intersectionObserver = null;
    window.clearTimeout(this._scrollTimer);
    window.clearTimeout(this._pointerResetTimer);
  }

  private releaseSubdelegates(): void {
    for (const subdelegate of this._subdelegates) subdelegate.release();
    this._subdelegates.length = 0;
  }

  private recordFrame(cost: number): void {
    this._renderedFrames++;
    this._frameCostTotal += cost;
    this._frameCostSamples++;
    if (this._frameCostSamples >= 60) {
      const sampledAt = performance.now();
      this._averageFrameCost = this._frameCostTotal / this._frameCostSamples;
      this._actualFps = this._frameCostSamples * 1000 /
        Math.max(1, sampledAt - this._frameSampleStartedAt);
      this._frameCostTotal = 0;
      this._frameCostSamples = 0;
      this._frameSampleStartedAt = sampledAt;
      this.updatePerformanceState();
    }
  }

  private resetFrameSample(): void {
    this._frameCostTotal = 0;
    this._frameCostSamples = 0;
    this._frameSampleStartedAt = performance.now();
  }

  private updatePerformanceState(): void {
    (window as any).__live2dPerformance = this.getStatus();
  }

  private getEffectFrameRateLimit(): number {
    const effects = (window as any).YusenEffects;
    const frameRate = Number(
      effects?.getLive2DFrameRate?.() ?? effects?.getFrameRate?.() ?? 0
    );
    return [15, 24, 30, 45, 60, 90].includes(frameRate) ? frameRate : 0;
  }

  private getTargetFps(): number {
    const frameRateLimit = this.getEffectFrameRateLimit();
    return frameRateLimit
      ? Math.min(this._activeFps, frameRateLimit)
      : this._activeFps;
  }

  private constructor() {
    this._cubismOption = new Option();
    this._subdelegates = [];
    this._lowPowerDevice =
      ((navigator as any).hardwareConcurrency || 8) <= 4 ||
      ((navigator as any).deviceMemory || 8) <= 4;
    this._activeFps = 90;
  }

  private _cubismOption: Option;
  private _subdelegates: LAppSubdelegate[];
  private _canvas: HTMLCanvasElement = null;
  private _initialized = false;
  private _running = false;
  private _environmentEnabled = true;
  private _inViewport = true;
  private _scrolling = false;
  private _pointerCaptured = false;
  private _mouseTrackingEnabled = true;
  private _idleMotionEnabled = true;
  private _frameRequest = 0;
  private _pointerMovePending = false;
  private _lastRenderTime = 0;
  private _pendingPointerX = 0;
  private _pendingPointerY = 0;
  private _scrollTimer = 0;
  private _pointerResetTimer = 0;
  private _intersectionObserver: IntersectionObserver = null;
  private _lowPowerDevice: boolean;
  private _activeFps: number;
  private _renderedFrames = 0;
  private _frameCostTotal = 0;
  private _frameCostSamples = 0;
  private _averageFrameCost = 0;
  private _actualFps = 0;
  private _frameSampleStartedAt = performance.now();
}
