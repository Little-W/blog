import process from 'node:process';
import qrcode from 'qrcode-terminal';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const workerURL = option('--url') || process.env.WORKER_URL;
const adminToken = process.env.PARSER_ADMIN_TOKEN;
if (!workerURL || !adminToken) {
  console.error('用法：WORKER_URL=https://你的-worker.workers.dev PARSER_ADMIN_TOKEN=... npm run login');
  process.exitCode = 1;
} else {
  const baseURL = workerURL.replace(/\/+$/, '');
  const headers = { authorization: `Bearer ${adminToken}` };
  const request = async (path, options = {}) => {
    const response = await fetch(`${baseURL}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.message || `HTTP ${response.status}`);
    return body.data;
  };
  try {
    const qr = await request('/admin/login/qr', { method: 'POST' });
    console.log('请使用 B 站 App 扫码并确认：');
    qrcode.generate(qr.url, { small: true });
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await request(`/admin/login/qr/status?key=${encodeURIComponent(qr.key)}`);
      if (status.state === 'success') {
        console.log('登录成功：B 站会话已加密保存到 Workers KV。');
        break;
      }
      console.log(status.message || '等待扫码确认…');
    }
  } catch (error) {
    console.error(`登录失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
