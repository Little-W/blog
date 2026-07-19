import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useThemeConfig} from '@docusaurus/theme-common';
import ThemedImage from '@theme/ThemedImage';
import {AdminAvatarMenu} from '@site/src/components/AdminSession';

import styles from './styles.module.css';

export default function NavbarLogo(): JSX.Element {
  const {
    siteConfig: {title},
  } = useDocusaurusContext();
  const {
    navbar: {title: navbarTitle, logo},
  } = useThemeConfig();
  const logoLink = useBaseUrl(logo?.href || '/');
  const logoLight = useBaseUrl(logo?.src || '');
  const logoDark = useBaseUrl(logo?.srcDark || logo?.src || '');
  const fallbackAlt = navbarTitle ? '' : title;
  const alt = logo?.alt ?? fallbackAlt;

  return (
    <div className="navbar__brand">
      {logo ? (
        <AdminAvatarMenu align="start">
          <Link
            className={styles.avatarLink}
            to={logoLink}
            aria-label={alt || '返回首页'}
            {...(logo.target ? {target: logo.target} : {})}>
            <div className="navbar__logo">
              <ThemedImage
                className={logo.className}
                sources={{
                  light: logoLight,
                  dark: logoDark,
                }}
                height={logo.height}
                width={logo.width}
                alt={alt}
                style={logo.style}
              />
            </div>
          </Link>
        </AdminAvatarMenu>
      ) : null}
      {navbarTitle != null ? (
        <Link className={styles.titleLink} to={logoLink} tabIndex={-1} aria-hidden="true">
          <b className="navbar__title text--truncate">{navbarTitle}</b>
        </Link>
      ) : null}
    </div>
  );
}
