import React, {type ImgHTMLAttributes, useEffect, useMemo, useRef, useState} from 'react';
import {acquireImageSlot, imageUrlOnMirror, mirrorsInPreferenceOrder, type ImageMirror} from './image-mirrors';
import styles from './pixiv.module.css';

type PixivImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string;
  preferredMirror: ImageMirror;
  priority: number;
  enabled?: boolean;
  placeholderClassName?: string;
  onMirrorFailure?: (mirror: ImageMirror) => void;
  onError?: ImgHTMLAttributes<HTMLImageElement>['onError'];
};

export default function PixivImage({src, preferredMirror, priority, enabled = true, placeholderClassName, onMirrorFailure, onError, onLoad, ...props}: PixivImageProps) {
  const mirrors = useMemo(() => mirrorsInPreferenceOrder(preferredMirror), [preferredMirror]);
  const [attempt, setAttempt] = useState(0);
  const [nearViewport, setNearViewport] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<number | null>(null);
  const [loadCycle, setLoadCycle] = useState(0);
  const imageRef = useRef<HTMLElement | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => setAttempt(0), [src, preferredMirror]);

  useEffect(() => {
    const image = imageRef.current;
    if (!enabled || !image) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, {rootMargin: '500px 0px'});
    observer.observe(image);
    return () => observer.disconnect();
  }, [enabled, src]);

  useEffect(() => {
    if (!enabled || !nearViewport || !src) return undefined;
    const controller = new AbortController();
    setActiveAttempt(null);
    const preempt = () => {
      if (imageRef.current instanceof HTMLImageElement) imageRef.current.removeAttribute('src');
      releaseRef.current?.();
      releaseRef.current = null;
      setActiveAttempt(null);
      setLoadCycle((cycle) => cycle + 1);
    };
    void acquireImageSlot(priority, controller.signal, preempt).then((release) => {
      if (controller.signal.aborted) {
        release();
        return;
      }
      releaseRef.current = release;
      setActiveAttempt(attempt);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    });
    return () => {
      controller.abort();
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [attempt, enabled, loadCycle, nearViewport, priority, src]);

  const releaseSlot = () => {
    releaseRef.current?.();
    releaseRef.current = null;
  };

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    releaseSlot();
    onError?.(event);
    if (attempt < mirrors.length - 1) {
      if (attempt === 0) onMirrorFailure?.(mirrors[attempt]);
      setAttempt(attempt + 1);
    }
  };

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    releaseSlot();
    onLoad?.(event);
  };

  const activeSrc = activeAttempt === attempt ? imageUrlOnMirror(src, mirrors[attempt] || preferredMirror) : '';
  if (!activeSrc) {
    return <span ref={(node) => {imageRef.current = node;}} className={placeholderClassName || styles.imagePlaceholder} aria-hidden="true" />;
  }

  return (
    <img
      {...props}
      ref={(node) => {imageRef.current = node;}}
      src={activeSrc}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}
