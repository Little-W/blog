import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const workerURL = process.env.WORKER_URL?.replace(/\/+$/, '');
const adminToken = process.env.PARSER_ADMIN_TOKEN;
const sessionFile = process.env.BILI_SESSION_FILE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'my-website-bili-player', 'session.json');

if (!workerURL || !adminToken) {
  console.error('用法：WORKER_URL=https://你的-worker.workers.dev PARSER_ADMIN_TOKEN=... npm run import-session');
  process.exitCode = 1;
} else {
  try {
    const session = JSON.parse(await readFile(sessionFile, 'utf8'));
    if (!Array.isArray(session?.cookies) || !session.cookies.some((cookie) => cookie?.name === 'SESSDATA' && cookie.value)) {
      throw new Error('本地会话文件不包含 SESSDATA；请先用 local-bili-parser 扫码登录。');
    }
    const response = await fetch(`${workerURL}/admin/session/import`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ cookies: session.cookies })
    });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.message || `HTTP ${response.status}`);
    console.log(body.data.authenticated
      ? '本地 B 站会话已加密导入 Workers KV，并通过远端校验。'
      : '本地 B 站会话已加密导入 Workers KV；远端校验暂未通过，请继续测试解析接口。');
  } catch (error) {
    console.error(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
