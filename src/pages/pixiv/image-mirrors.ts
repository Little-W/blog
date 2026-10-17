export const IMAGE_MIRRORS = ['i.pixiv.re', 'i.pixiv.nl'] as const;
export type ImageMirror = typeof IMAGE_MIRRORS[number];

const DEFAULT_MIRROR: ImageMirror = IMAGE_MIRRORS[0];
const PREFERENCE_KEY = 'pixiv-image-mirror';
export const MAX_IMAGE_CONCURRENCY = 4;

type ImageJob = {
  priority: number;
  sequence: number;
  signal: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: DOMException) => void;
  onAbort: () => void;
};

const imageQueue: ImageJob[] = [];
let activeImageCount = 0;
let jobSequence = 0;
let pumpQueued = false;

function scheduleImageQueue(): void {
  if (pumpQueued) return;
  pumpQueued = true;
  queueMicrotask(() => {
    pumpQueued = false;
    imageQueue.sort((left, right) => left.priority - right.priority || left.sequence - right.sequence);
    while (activeImageCount < MAX_IMAGE_CONCURRENCY && imageQueue.length > 0) {
      const job = imageQueue.shift()!;
      if (job.signal.aborted) continue;
      job.signal.removeEventListener('abort', job.onAbort);
      activeImageCount += 1;
      let released = false;
      job.resolve(() => {
        if (released) return;
        released = true;
        activeImageCount = Math.max(0, activeImageCount - 1);
        scheduleImageQueue();
      });
    }
  });
}

export function acquireImageSlot(priority: number, signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Image load cancelled', 'AbortError'));
      return;
    }
    const job: ImageJob = {
      priority,
      sequence: jobSequence++,
      signal,
      resolve,
      reject,
      onAbort: () => {
        const index = imageQueue.indexOf(job);
        if (index !== -1) imageQueue.splice(index, 1);
        reject(new DOMException('Image load cancelled', 'AbortError'));
        scheduleImageQueue();
      },
    };
    imageQueue.push(job);
    signal.addEventListener('abort', job.onAbort, {once: true});
    scheduleImageQueue();
  });
}

export function readMirrorPreference(): ImageMirror {
  if (typeof window === 'undefined') return DEFAULT_MIRROR;
  try {
    const saved = window.localStorage.getItem(PREFERENCE_KEY);
    return IMAGE_MIRRORS.includes(saved as ImageMirror) ? saved as ImageMirror : DEFAULT_MIRROR;
  } catch {
    return DEFAULT_MIRROR;
  }
}

export function saveMirrorPreference(mirror: ImageMirror): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(PREFERENCE_KEY, mirror);
  } catch {
    // Mirror probing still works for this page view if storage is unavailable.
  }
}

export function imageUrlOnMirror(rawUrl: string, mirror: ImageMirror): string {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === 'i.pximg.net' || IMAGE_MIRRORS.includes(url.hostname as ImageMirror)) {
      url.hostname = mirror;
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function mirrorsInPreferenceOrder(preferred: ImageMirror): ImageMirror[] {
  return [preferred, ...IMAGE_MIRRORS.filter((mirror) => mirror !== preferred)];
}

export function measureFastestMirror(rawUrl: string, timeoutMs = 4000): Promise<ImageMirror | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null);

  return Promise.all(IMAGE_MIRRORS.map((mirror) => new Promise<{mirror: ImageMirror; elapsed: number} | null>((resolve) => {
    const image = new Image();
    const startedAt = performance.now();
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(loaded ? {mirror, elapsed: performance.now() - startedAt} : null);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.src = imageUrlOnMirror(rawUrl, mirror);
  }))).then((results) => {
    const fastest = results.filter((result): result is {mirror: ImageMirror; elapsed: number} => result !== null)
      .sort((left, right) => left.elapsed - right.elapsed)[0];
    return fastest?.mirror || null;
  });
}
