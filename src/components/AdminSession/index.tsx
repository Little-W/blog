import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  user: AdminUser | null;
  repository: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionValue>({
  authenticated: false,
  loading: true,
  user: null,
  repository: null,
  refresh: async () => undefined,
  logout: async () => undefined,
});

export function AdminSessionProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState({
    authenticated: false,
    loading: true,
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
        user: data?.authenticated ? data.user : null,
        repository: data?.authenticated ? data.repository : null,
      });
    } catch {
      setSession({authenticated: false, loading: false, user: null, repository: null});
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
      setSession({authenticated: false, loading: false, user: null, repository: null});
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

export function AdminAvatarMenu({
  children,
  align = 'center',
}: {
  children: ReactNode;
  align?: 'center' | 'start';
}) {
  const {authenticated, loading, user, repository, logout} = useAdminSession();
  const returnTo = typeof window === 'undefined'
    ? '/'
    : `${window.location.pathname}${window.location.search}`;

  return (
    <div
      className={`${styles.avatarMenu} ${align === 'start' ? styles.alignStart : ''}`}
      tabIndex={0}>
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
