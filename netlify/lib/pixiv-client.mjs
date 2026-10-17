const DEFAULT_CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
const DEFAULT_CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';

export async function getPixivAccessToken() {
  const refreshToken = process.env.PIXIV_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('MISSING_PIXIV_CREDENTIALS');

  const response = await fetch('https://oauth.secure.pixiv.net/auth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'App-OS': 'android',
      'App-OS-Version': '15',
      'App-Version': '6.180.0',
      'User-Agent': 'PixivAndroidApp/6.180.0 (Android 15; Pixel 9)',
    },
    body: new URLSearchParams({
      client_id: process.env.PIXIV_CLIENT_ID || DEFAULT_CLIENT_ID,
      client_secret: process.env.PIXIV_CLIENT_SECRET || DEFAULT_CLIENT_SECRET,
      get_secure_url: 'true',
      include_policy: 'true',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const body = await response.json().catch(() => ({}));
  const auth = body.response || body;
  if (!response.ok || !auth.access_token) {
    throw new Error(`刷新 Pixiv token 失败：${response.status}`);
  }
  return auth.access_token;
}

export async function pixivApi(path, accessToken) {
  const response = await fetch(`https://app-api.pixiv.net${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'App-OS': 'ios',
      'App-OS-Version': '17.0',
      'User-Agent': 'PixivIOSApp/7.13.3 (iOS 17.0; iPhone14,3)',
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(`Pixiv API error: ${response.status}`);
  return body;
}

export function publicImageUrls(value) {
  if (Array.isArray(value)) return value.map(publicImageUrls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicImageUrls(item)]));
  }
  return typeof value === 'string'
    ? value.replace(/^https:\/\/i\.pximg\.net\//, 'https://i.pixiv.re/')
    : value;
}
