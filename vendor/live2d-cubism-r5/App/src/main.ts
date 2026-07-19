/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 *
 * Site integration: Copyright 2026 Yusen.
 */

import { LAppDelegate } from './lappdelegate';

export const version = '5-r.5';
export const rendererName = 'Live2D Cubism Web SDK R5';

export interface InitOptions {
  canvasId?: string;
  mouseTracking?: boolean;
  idleMotion?: boolean;
}

let initialized = false;

function getDelegate(): LAppDelegate {
  return LAppDelegate.getInstance();
}

export function init(options: InitOptions = {}): boolean {
  if (initialized) return true;
  if (!(window as any).Live2DCubismCore) {
    console.warn('[Live2D] Cubism Core is unavailable.');
    return false;
  }

  const canvas = document.getElementById(options.canvasId || 'live2d') as
    HTMLCanvasElement;
  if (!canvas) {
    console.warn('[Live2D] The Live2D canvas was not found.');
    return false;
  }

  const delegate = getDelegate();
  initialized = delegate.initialize(canvas, {
    mouseTracking: options.mouseTracking,
    idleMotion: options.idleMotion
  });
  if (!initialized) return false;

  delegate.run();
  const bridge = {
    version,
    renderer: rendererName,
    setMouseTrackingEnabled(enabled: boolean): void {
      delegate.setMouseTrackingEnabled(enabled);
    },
    setIdleMotionEnabled(enabled: boolean): void {
      delegate.setIdleMotionEnabled(enabled);
    },
    setRenderingEnabled(enabled: boolean): void {
      delegate.setRenderingEnabled(enabled);
    },
    markInteraction(duration?: number): void {
      delegate.markInteraction(duration);
    },
    getStatus(): Record<string, unknown> {
      return delegate.getStatus();
    },
    destroy(): void {
      destroy();
    }
  };

  (window as any).YusenLive2DRenderer = bridge;
  (window as any).__setLive2dRenderingEnabled = (enabled: boolean): void => {
    delegate.setRenderingEnabled(enabled);
  };
  window.dispatchEvent(new CustomEvent('yusen:live2d-renderer-ready', {
    detail: { version, renderer: rendererName }
  }));
  return true;
}

export function destroy(): void {
  if (!initialized) return;
  LAppDelegate.releaseInstance();
  initialized = false;
  delete (window as any).YusenLive2DRenderer;
}

window.addEventListener('beforeunload', destroy, { passive: true });
