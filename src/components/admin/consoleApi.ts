type ApiResult<T> = {success: boolean; data: T; message?: string; code?: string};

export type GitSyncResult = {
  ok: boolean;
  commitSha?: string;
  commitUrl?: string;
  message?: string;
};

export function describeGitSync(gitSync?: GitSyncResult | null): string {
  if (!gitSync) return '';
  if (gitSync.ok) {
    return gitSync.commitSha ? `，已同步 GitHub 提交 ${gitSync.commitSha.slice(0, 8)}` : '，已同步 GitHub';
  }
  return `，但 GitHub 同步失败（${gitSync.message || '未知错误'}）`;
}

export class ConsoleApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function consoleApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(init?.body ? {'content-type': 'application/json; charset=utf-8'} : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    throw new ConsoleApiError(payload.message || `请求失败（${response.status}）`, response.status, payload.code);
  }
  return payload.data;
}

export async function consoleUpload<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {accept: 'application/json'},
    body: form,
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    throw new ConsoleApiError(payload.message || `请求失败（${response.status}）`, response.status, payload.code);
  }
  return payload.data;
}
