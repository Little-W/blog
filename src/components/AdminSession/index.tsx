import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from '@docusaurus/Link';
import {Icon} from '@iconify/react';

import styles from './styles.module.css';

type AdminUser = {
  login: string;
  avatarUrl: string;
};

type AdminSessionValue = {
  authenticated: boolean;
  loading: boolean;
  lookupFailed: boolean;
  user: AdminUser | null;
  repository: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionValue>({
  authenticated: false,
  loading: true,
  lookupFailed: false,
  user: null,
  repository: null,
  refresh: async () => undefined,
  logout: async () => undefined,
});

export function AdminSessionProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState({
    authenticated: false,
    loading: true,
    lookupFailed: false,
    user: null as AdminUser | null,
    repository: null as string | null,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/console/auth', {
        credentials: 'same-origin',
        headers: {accept: 'application/json'},
      });
      const payload = await response.json();
      const data = payload?.data;
      setSession({
        authenticated: Boolean(response.ok && data?.authenticated),
        loading: false,
        lookupFailed: !response.ok || payload?.success === false,
        user: data?.authenticated ? data.user : null,
        repository: data?.authenticated ? data.repository : null,
      });
    } catch {
      setSession({authenticated: false, loading: false, lookupFailed: true, user: null, repository: null});
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/console/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {accept: 'application/json'},
      });
    } finally {
      setSession({authenticated: false, loading: false, lookupFailed: false, user: null, repository: null});
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({...session, refresh, logout}),
    [session, refresh, logout],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}

type WaifuTip = {
  text: string;
  timeout: number;
};

declare global {
  interface Window {
    __yusenWaifuTipQueue?: WaifuTip[];
    showMessage?: (text: string | string[], timeout?: number | null) => void;
  }
}

function showWaifuTip(text: string, timeout = 3600) {
  if (typeof window === 'undefined') return;
  if (typeof window.showMessage === 'function') {
    window.showMessage(text, timeout);
    return;
  }
  const queue = window.__yusenWaifuTipQueue || [];
  queue.push({text, timeout});
  window.__yusenWaifuTipQueue = queue.slice(-3);
  window.dispatchEvent(new CustomEvent('yusen:waifu-tip', {detail: {text, timeout}}));
}

function failedLoginTip() {
  if (typeof window === 'undefined') return null;
  const result = new URLSearchParams(window.location.search).get('adminAuth');
  switch (result) {
    case 'invalid-state':
      return '呜，刚才的登录验证没有对上，再试一次好吗？';
    case 'denied':
      return '唔，登录授权被取消了。想进控制台的话，再点一次就好啦~';
    case 'token-failed':
      return '登录没能完成，可能是 GitHub 那边开小差了，等会儿再试试吧~';
    case 'not-owner':
      return '抱歉呀，只有主人才能打开这个控制台哦~';
    default:
      return null;
  }
}

function currentReturnTo() {
  if (typeof window === 'undefined') return '/';
  const current = new URL(window.location.href);
  current.searchParams.delete('adminAuth');
  return `${current.pathname}${current.search}${current.hash}`;
}

export function AdminAvatarMenu({
  children,
  align = 'center',
}: {
  children: ReactNode;
  align?: 'center' | 'start';
}) {
  const {authenticated, loading, lookupFailed, user, repository, logout} = useAdminSession();
  const lastTip = useRef<{text: string; at: number}>({text: '', at: 0});
  const returnTo = currentReturnTo();
  const loginFailure = failedLoginTip();

  useEffect(() => {
    if (loading || !loginFailure) return;
    showWaifuTip(loginFailure, 4400);
    const current = new URL(window.location.href);
    current.searchParams.delete('adminAuth');
    window.history.replaceState(window.history.state, '', `${current.pathname}${current.search}${current.hash}`);
  }, [loading, loginFailure]);

  const greetAvatar = useCallback(() => {
    let text: string;
    if (loading) {
      text = '稍等一下哦，让我确认一下来访者的身份~';
    } else if (authenticated) {
      text = '主人，欢迎回来~ 控制台已经准备好啦！';
    } else if (loginFailure) {
      text = loginFailure;
    } else if (lookupFailed) {
      text = '唔，登录状态没有读到。网络恢复后再试一次吧~';
    } else {
      text = '要登录控制台吗？我会先确认你是不是主人哦~';
    }
    const now = Date.now();
    if (lastTip.current.text === text && now - lastTip.current.at < 2600) return;
    lastTip.current = {text, at: now};
    showWaifuTip(text);
  }, [authenticated, loading, loginFailure, lookupFailed]);

  return (
    <div
      className={`${styles.avatarMenu} ${align === 'start' ? styles.alignStart : ''}`}
      tabIndex={0}
      onMouseEnter={greetAvatar}
      onFocus={greetAvatar}>
      {children}
      <div className={styles.hoverPanel} role="dialog" aria-label="博客控制台登录">
        {loading ? (
          <div className={styles.statusLine}>
            <Icon icon="lucide:loader-circle" className={styles.spinner} />
            检查登录状态
          </div>
        ) : authenticated ? (
          <>
            <div className={styles.ownerLine}>
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
              <div>
                <strong>{user?.login}</strong>
                <span>{repository}</span>
              </div>
            </div>
            <Link className={styles.primaryAction} to="/admin">
              <Icon icon="lucide:panel-top-open" />
              进入管理页面
            </Link>
            <button className={styles.textAction} type="button" onClick={() => void logout()}>
              退出登录
            </button>
          </>
        ) : (
          <>
            <div className={styles.panelTitle}>GitHub 仓库认证</div>
            <p>仅 blog 仓库所有者可进入控制台。</p>
            <a
              className={styles.primaryAction}
              href={`/api/console/login?returnTo=${encodeURIComponent(returnTo)}`}>
              <Icon icon="mdi:github" />
              使用 GitHub 登录
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminEditButton({source}: {source?: string}) {
  const {authenticated} = useAdminSession();
  if (!authenticated || !source) return null;
  const path = source.replace(/^@site\//, '');
  if (!/^(docs|blog)\/.+\.(md|mdx)$/i.test(path)) return null;
  return (
    <div className={styles.editRow}>
      <Link className={styles.editButton} to={`/admin?file=${encodeURIComponent(path)}`}>
        <Icon icon="lucide:file-pen-line" />
        编辑此页
      </Link>
    </div>
  );
}
