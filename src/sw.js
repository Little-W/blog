import {registerRoute} from 'workbox-routing';
import {CacheFirst, StaleWhileRevalidate} from 'workbox-strategies';
import {CacheableResponsePlugin} from 'workbox-cacheable-response';
import {ExpirationPlugin} from 'workbox-expiration';

export default function swCustom(params) {
  if (params.debug) {
    console.log('[Docusaurus-PWA][SW]: running swCustom code', params);
  }

  // Cache responses from external resources
  registerRoute(
    (context) =>
      [
        /graph\.facebook\.com\/.*\/picture/,
        /netlify\.com\/img/,
        /avatars1\.githubusercontent/,
      ].some((regex) => context.url.href.match(regex)),
    new StaleWhileRevalidate(),
  );

  // 曲目封面使用 Cache Storage 持久保存。只处理 image 请求，不会把
  // 同域名下的音频或其他大文件放入该缓存。
  const musicCoverHosts = new Set([
    'aifasthub.com',
    'hf-cdn.sufy.com',
    'hf-mirror.com',
    'huggingface.co',
    'bitbucket.org',
  ]);
  registerRoute(
    ({request, url}) =>
      request.destination === 'image' && musicCoverHosts.has(url.hostname),
    new CacheFirst({
      cacheName: 'yusen-music-covers-v1',
      plugins: [
        new CacheableResponsePlugin({statuses: [0, 200]}),
        new ExpirationPlugin({
          maxEntries: 600,
          maxAgeSeconds: 60 * 60 * 24 * 30,
          purgeOnQuotaError: true,
        }),
      ],
    }),
  );
}
