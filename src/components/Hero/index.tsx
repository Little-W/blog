import React from 'react';

import { useTrail, animated } from '@react-spring/web';
import Translate from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Link from '@docusaurus/Link';

import HeroMain from './img/hero_main.svg';

import JuejinIcon from '@site/static/svg/juejin.svg';
import { Icon } from '@iconify/react';

import styles from './styles.module.scss';

function Hero() {
  const trails = useTrail(4, {
    from: { opacity: 0, transform: 'translate3d(0px, 2em, 0px)' },
    to: { opacity: 1, transform: 'translate3d(0px, 0px, 0px)' },
    config: {
      mass: 3,
      tension: 460,
      friction: 45,
    },
  });

  return (
    <animated.div className={styles.hero}>
      <div className={styles.bloghome__intro}>
        <animated.div style={trails[0]} className={styles.hero_text}>
          <Translate id="homepage.hero.greet">你好! 我是</Translate>
          <span className={styles.intro__name}>
            <Translate id="homepage.hero.name">Yusen</Translate>
          </span>
			<p>	　ようこそ<span className={styles.intro__name}>私の世界</span>へ</p>
        </animated.div>
        <animated.p style={trails[1]}>
          <Translate id="homepage.hero.text">
            {`　　如果尖锐的批评完全消失，温和的批评将会变得刺耳。如果温和的批评也不被允许，
	    沉默将被认为居心叵测。如果沉默也不再允许，赞扬不够卖力将是一种罪行。
	    如果只允许一种声音存在，那么，唯一存在的那个声音就是谎言。 　　　　　
	`}
          </Translate>
		  <p align="right"> ——苏格拉底</p>
          <br />
          <br />
          <Translate
            id="homepage.hero.look"
            values={{
              link: (
                <Link to="/website">
                  <Translate id="hompage.hero.link">网址导航</Translate>
                </Link>
              ),		  
              idea: (
                <Link to="/tags/随笔">
                  <Translate id="hompage.hero.idea">想法感悟</Translate>
                </Link>
              ),
            }}
          >
            {`你可以随处逛逛，查看{link} 、以及我的{idea}。`}
          </Translate>
        </animated.p>
        <SocialLinks style={trails[2]} />
        <animated.div style={trails[3]}>
          <a className={styles.intro} href={'./about'}>
            <Translate id="hompage.hero.introduce">自我介绍</Translate>
          </a>
        </animated.div>
      </div>
      <div className={styles.bloghome__image}>
        <HeroMain />
      </div>
    </animated.div>
  );
}

export function SocialLinks({ ...prop }) {
  const { siteConfig } = useDocusaurusContext();
  const { themeConfig } = siteConfig;
  const socials = themeConfig.socials as {
    github: string;
    twitter: string;
    juejin: string;
    csdn: string;
    qq: string;
    wx: string;
    cloudmusic: string;
    zhihu: string;
  };

  return (
    <animated.div className={styles.social__links} {...prop}>
      <a href="/rss.xml" target="_blank">
        <Icon icon='ri:rss-line' />
      </a>
      <a href={socials.github} target="_blank">
        <Icon icon='ri:github-line' />
      </a>
      <a href={socials.qq} target="_blank">
        <Icon icon='ri:qq-line' />
      </a>
    </animated.div>
  );
}

export default Hero;
