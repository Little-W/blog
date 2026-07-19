const path = require('path')
const beian = '<a href="https://icp.gov.moe/?keyword=20223914" target="_blank">萌ICP备20223914号</a>'


/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Yusenの小站',
  titleDelimiter: '-',
  url: 'https://little-w.github.io',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'yusen',
  projectName: 'blog',
  tagline: '時よ過ぎゆけ、お前は残酷だ',
  /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
  themeConfig: {
    image: 'img/logo.png',
 /**   announcementBar: {
      id: 'announcementBar-3',
      content: announcementBarContent,
    },
	*/
    metadata: [
      {
        name: 'keywords',
        content:'Yusen'
      },
      {
        name: 'keywords',
        content: 'blog, 杂谈 ,',
      },
    ],
    docs: {
      sidebar: {
        hideable: true,
      }
    },
    navbar: {
      title: 'Yusen',
      logo: {
        alt: 'Yusen',
        src: 'img/logo.webp',
        srcDark: 'img/logo.webp',
      },
      hideOnScroll: true,
      items: [
        {
          label: '学习笔记',
          position: 'right',
          items: [
			{
              label: '日语',
              to: 'docs/notes/Japanese',
            },
			{
              label: '数字设计',
              to: 'docs/notes/digital-design',
            },
          ],
        },
		 {
              label: '其他文章',
			  position: 'right',
              to: 'docs/etc/',
          },
        {
              label: '标签',
              position: 'right',
              to: 'docs/tags',
        },
		{
          label: '网址导航',
          position: 'left',
          to: 'website',
        },
        {
          label: '音乐',
          position: 'left',
          to: 'music',
        },
        {
          label: '显示设置',
          position: 'left',
          to: 'settings',
        },

      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '博客',
          items: [
           {
              label: '首页',
              to: '/',
          },
		 {
              label: '笔记',
              to: 'docs/notes/',
          },
		  {
              label: '杂项',
              to: 'docs/etc/',
          },
           {
              label: '标签',
              to: 'docs/tags',
          },
 

          ],
        },


        {
          title: '社交媒体',
          items: [
            {
              label: '关于我',
              to: '/about',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/Little-W',
            },
          ],
        },
        {
          title: '更多',
          items: [{
            label: '友链',
            position: 'right',
            to: 'friends',
          }, {
            label: '导航',
            position: 'right',
            to: 'website',
          },
          {
            html: `<a href="https://docusaurus.cn/" target="_blank"><img style="height:50px;margin-top:0.5rem" src="/img/buildwith.png" /><a/>`
          },
        ],
        },
      ],
      copyright: `<p>Copyright © 2022 - now • Yusen Built with Docusaurus.</p>
                  <p>${beian}</p>`,
    },
    prism: {
      theme: require('prism-react-renderer/themes/vsLight'),
      darkTheme: require('prism-react-renderer/themes/vsDark'),
      additionalLanguages: [
        'bash',
        'c',
        'cpp',
        'diff',
        'docker',
        'java',
        'json',
        'makefile',
        'ini',
        'php',
        'python',
        'sql',
        'tcl',
        'toml',
        'verilog',
        'yaml',
      ],
      defaultLanguage: 'javascript',
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: {start: 'highlight-start', end: 'highlight-end'},
        },
        {
          className: 'code-block-error-line',
          line: 'This will error',
        },
      ],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
    zoom: {
      selector: '.markdown :not(em) > img',
      background: {
        light: 'rgb(255, 255, 255)',
        dark: 'rgb(50, 50, 50)'
      },
      config: {}
    },
    giscus: {
      repo: 'little-W/blog',
      repoId: 'R_kgDOIkujTQ',
      category: 'Ideas',
      categoryId: 'DIC_kwDOIkujTc4CS_EL',
      mapping: 'pathname',
      lang: 'zh-CN',
    },
    liveCodeBlock: {
      playgroundPosition: 'top',
    },
    socials: {
      github: 'https://github.com/Little-W',
      qq: 'https://qm.qq.com/cgi-bin/qm/qr?k=y4eBDiKgn2wxTvy4sRgW8q_T_0bgnr1-&noverify=0&personal_qrcode_source=4',
	  bilibili:'https://space.bilibili.com/297325003',
	  twitter:'https://twitter.com/yux2333',
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: 'docs',
          sidebarPath: 'sidebars.js',
        },
        blog: false,
        theme: {
          customCss: [require.resolve('./src/css/custom.scss')],
        },
        sitemap: {
          changefreq: 'daily',
          priority: 0.5,
        },
        gtag: {
          trackingID: "G-S4SD5NXWXF",
          anonymizeIP: true,
        },
        // debug: true,
      }),
    ],
  ],
  // themes: ['@docusaurus/theme-live-codeblock'],
  plugins: [
    function nativeSiteAssetsPlugin() {
      return {
        name: 'native-site-assets',
        injectHtmlTags() {
          // 开发环境使用本机解析器；生产构建设置为 /api 和 netlify，
          // 静态页面仅取得同源接口地址，不包含管理员令牌。
          const biliParserApi = process.env.BILI_PARSER_API || 'http://127.0.0.1:19180/api';
          const biliParserMode = process.env.BILI_PARSER_MODE || 'local';
          const files = [
            'theme-transition.js', 'jquery.min.js', 'jsrender.min.js', 'aplayer.js', 'animate.js',
          ];
          return {
            postBodyTags: [
              {
                tagName: 'script',
                innerHTML: `window.MY_WEBSITE_BILI_PARSER_API=${JSON.stringify(biliParserApi)};window.MY_WEBSITE_BILI_PARSER_MODE=${JSON.stringify(biliParserMode)};`,
              },
            ].concat(files.map((src) => ({tagName: 'script', attributes: {src: `/custom/js/${src}`}}))).concat([
              {tagName: 'script', attributes: {src: '/custom/js/effects-manager.js'}},
            ]),
          };
        },
      };
    },
    'docusaurus-plugin-image-zoom',
    'docusaurus-plugin-sass',
    path.resolve(__dirname, './src/plugin/plugin-baidu-tongji'),
    path.resolve(__dirname, './src/plugin/plugin-baidu-push'),
    [
      path.resolve(__dirname, './src/plugin/plugin-content-blog'), {
        path: 'blog',
        routeBasePath: '/',

        blogSidebarCount: 10,
        postsPerPage: 10,
        showReadingTime: true,
        readingTime: ({ content, frontMatter, defaultReadingTime }) =>
          defaultReadingTime({ content, options: { wordsPerMinute: 300 } }),
        feedOptions: {
          type: 'all',
          title: 'Yusen',
          copyright: `Copyright © ${new Date().getFullYear()} Yusen Built with Docusaurus.<p>${beian}</p>`,
        },
      }
    ],
    [
      '@docusaurus/plugin-pwa',
      {
        debug: true,
        offlineModeActivationStrategies: ['appInstalled', 'standalone', 'queryString'],
        pwaHead: [
          {
            tagName: 'link',
            rel: 'icon',
            href: '/img/logo.png',
          },
          {
            tagName: 'link',
            rel: 'manifest',
            href: '/manifest.json',
          },
          {
            tagName: 'meta',
            name: 'theme-color',
            content: 'rgb(51 139 255)',
          },
        ],
      },
    ],
  ],
  stylesheets: [
    { href: '/custom/css/custom.css' },
  ],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh'],
  },
}

module.exports = config;
