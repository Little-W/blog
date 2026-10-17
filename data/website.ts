import { Friends } from './friend';

export interface Website {
  name: string;
  logo: string;
  desc: string;
  href: string;
  tags?: string[];
}

export interface WebsiteCategory {
  name: string;
  websites: Website[];
}

const friends: Website[] = Friends.map((f) => {
  return {
    ...f,
    name: f.title,
    desc: f.description,
    logo: f.avatar,
    href: f.website,
  };
});

export const websiteData: WebsiteCategory[] = [

  {
    name: 'AI',
    websites: [
      {
        name: 'ChatGPT',
        desc: 'OpenAI 出品的对话式 AI，通用大模型助手',
        logo: '/img/website/chatgpt_com.svg',
        href: 'https://chatgpt.com/',
        tags: ['AI', '对话'],
      },
      {
        name: 'Claude',
        desc: 'Anthropic 出品的 AI 助手，擅长长文与代码',
        logo: '/img/website/claude_ai.svg',
        href: 'https://claude.ai/',
        tags: ['AI', '对话'],
      },
      {
        name: 'Gemini',
        desc: 'Google 的多模态 AI 助手',
        logo: '/img/website/gemini_google_com.png',
        href: 'https://gemini.google.com/',
        tags: ['AI', '对话'],
      },
      {
        name: '通义千问',
        desc: '阿里云推出的大语言模型对话助手',
        logo: '/img/website/tongyi_aliyun_com.svg',
        href: 'https://tongyi.aliyun.com/',
        tags: ['AI', '对话'],
      },
      {
        name: 'DeepSeek',
        desc: '深度求索开源大模型，推理与代码能力出色',
        logo: '/img/website/deepseek_com.svg',
        href: 'https://www.deepseek.com/',
        tags: ['AI', '对话'],
      },
      {
        name: 'Kimi',
        desc: '月之暗面出品的 AI 助手，擅长超长上下文',
        logo: '/img/website/kimi_moonshot_cn.svg',
        href: 'https://kimi.moonshot.cn/',
        tags: ['AI', '对话'],
      },
      {
        name: '智谱清言',
        desc: '智谱 AI 推出的 GLM 大模型对话助手',
        logo: '/img/website/chatglm_cn.ico',
        href: 'https://chatglm.cn/',
        tags: ['AI', '对话'],
      },
      {
        name: 'Perplexity',
        desc: '带引用来源的 AI 搜索问答引擎',
        logo: '/img/website/perplexity_ai.svg',
        href: 'https://www.perplexity.ai/',
        tags: ['AI', '搜索'],
      },
      {
        name: 'Hugging Face',
        desc: '开源模型、数据集与 AI 应用社区',
        logo: '/img/website/huggingface_co.svg',
        href: 'https://huggingface.co/',
        tags: ['AI', '模型'],
      },
      {
        name: 'ModelScope 魔搭',
        desc: '阿里达摩院开源模型与数据集社区',
        logo: '/img/website/modelscope_cn.ico',
        href: 'https://modelscope.cn/',
        tags: ['AI', '模型'],
      },
      {
        name: 'OpenRouter',
        desc: '一个接口访问多家大模型 API 的平台',
        logo: '/img/website/openrouter_ai.png',
        href: 'https://openrouter.ai/',
        tags: ['AI', 'API'],
      },
      {
        name: 'Ollama',
        desc: '在本地一键运行开源大模型',
        logo: '/img/website/ollama_com.png',
        href: 'https://ollama.com/',
        tags: ['AI', '本地部署'],
      },
      {
        name: 'Midjourney',
        desc: 'AI 绘画与图像生成平台',
        logo: '/img/website/midjourney_com.png',
        href: 'https://www.midjourney.com/',
        tags: ['AI', '绘画'],
      },
      {
        name: 'Civitai',
        desc: 'Stable Diffusion 模型与提示词分享社区',
        logo: '/img/website/civitai_com.png',
        href: 'https://civitai.com/',
        tags: ['AI', '绘画'],
      },
      {
        name: 'arXiv',
        desc: 'AI 与计算机领域预印本论文库',
        logo: '/img/website/arxiv_org.svg',
        href: 'https://arxiv.org/',
        tags: ['AI', '论文'],
      },
      {
        name: 'Papers with Code',
        desc: '论文与开源代码、基准榜单对应索引',
        logo: '/img/website/paperswithcode_com.png',
        href: 'https://paperswithcode.com/',
        tags: ['AI', '论文'],
      },
    ],
  },

  {
    name: '数字 IC',
    websites: [
      {
        name: 'HDLBits',
        desc: '在线 Verilog / SystemVerilog 刷题平台',
        logo: '/img/website/hdlbits_01xz_net.svg',
        href: 'https://hdlbits.01xz.net/',
        tags: ['Verilog', '刷题'],
      },
      {
        name: 'ASIC-World',
        desc: 'Verilog、SystemVerilog 与验证教程合集',
        logo: '/img/website/asic_world_com.ico',
        href: 'http://www.asic-world.com/',
        tags: ['Verilog', '教程'],
      },
      {
        name: 'ChipVerify',
        desc: '数字设计与 SystemVerilog / UVM 验证教程',
        logo: '/img/website/chipverify_com.svg',
        href: 'https://www.chipverify.com/',
        tags: ['验证', '教程'],
      },
      {
        name: 'Verification Academy',
        desc: 'SystemVerilog / UVM 验证学习与问答平台',
        logo: '/img/website/verificationacademy_com.png',
        href: 'https://verificationacademy.com/',
        tags: ['验证', 'UVM'],
      },
      {
        name: 'EDA Playground',
        desc: '在线仿真 Verilog / SystemVerilog / VHDL',
        logo: '/img/website/edaplayground_com.png',
        href: 'https://www.edaplayground.com/',
        tags: ['仿真', '在线'],
      },
      {
        name: 'Doulos',
        desc: 'Verilog / SystemVerilog / UVM 培训与知识库',
        logo: '/img/website/doulos_com.svg',
        href: 'https://www.doulos.com/',
        tags: ['教程', '培训'],
      },
      {
        name: 'Verilator',
        desc: '开源高性能 Verilog / SystemVerilog 仿真器',
        logo: '/img/website/verilator_org.png',
        href: 'https://www.verilator.org/',
        tags: ['仿真', '开源'],
      },
      {
        name: 'Yosys',
        desc: '开源 RTL 综合工具',
        logo: '/img/website/yosyshq_net.png',
        href: 'https://yosyshq.net/yosys/',
        tags: ['综合', '开源'],
      },
      {
        name: 'cocotb',
        desc: '基于 Python 的 RTL 验证框架',
        logo: '/img/website/cocotb_org.svg',
        href: 'https://www.cocotb.org/',
        tags: ['验证', '开源'],
      },
      {
        name: 'OpenTitan',
        desc: '开源可信芯片根 Silicon Root of Trust 项目',
        logo: '/img/website/opentitan_org.png',
        href: 'https://opentitan.org/',
        tags: ['开源', 'SoC'],
      },
      {
        name: 'PULP Platform',
        desc: '开源 RISC-V 处理器与加速器平台',
        logo: '/img/website/pulp_platform_org.png',
        href: 'https://pulp-platform.org/',
        tags: ['RISC-V', '开源'],
      },
      {
        name: 'lowRISC',
        desc: '开源硬件与 RISC-V 生态组织',
        logo: '/img/website/lowrisc_org.png',
        href: 'https://lowrisc.org/',
        tags: ['RISC-V', '开源'],
      },
      {
        name: 'Chips Alliance',
        desc: '开源芯片与 EDA 基础设施联盟',
        logo: '/img/website/chipsalliance_org.png',
        href: 'https://chipsalliance.org/',
        tags: ['开源', 'EDA'],
      },
      {
        name: 'SpinalHDL',
        desc: '基于 Scala 的硬件描述语言',
        logo: '/img/website/spinalhdl_github_io.png',
        href: 'https://spinalhdl.github.io/SpinalDoc-RTD/',
        tags: ['HDL', '开源'],
      },
      {
        name: 'OpenCores',
        desc: '开源 IP 核与 SoC 设计仓库',
        logo: '/img/website/opencores_org.png',
        href: 'https://opencores.org/',
        tags: ['IP', '开源'],
      },
      {
        name: 'EETOP',
        desc: '国内 IC 设计与 EDA 技术社区',
        logo: '/img/website/eetop_cn.ico',
        href: 'https://www.eetop.cn/',
        tags: ['社区', 'IC'],
      },
      {
        name: 'Synopsys',
        desc: 'EDA 与 IP 龙头，数字设计、验证与综合工具',
        logo: '/img/website/synopsys_com.svg',
        href: 'https://www.synopsys.com/',
        tags: ['EDA', '工具'],
      },
      {
        name: 'Cadence',
        desc: '数字 IC 设计与验证 EDA 工具厂商',
        logo: '/img/website/cadence_com.svg',
        href: 'https://www.cadence.com/',
        tags: ['EDA', '工具'],
      },
      {
        name: 'AMD (Xilinx)',
        desc: 'FPGA 器件与 Vivado / Vitis 开发工具',
        logo: '/img/website/xilinx_com.svg',
        href: 'https://www.xilinx.com/',
        tags: ['FPGA', '工具'],
      },
      {
        name: 'VLSI System Design',
        desc: 'VLSI 与数字设计在线课程',
        logo: '/img/website/vlsisystemdesign_com.png',
        href: 'https://www.vlsisystemdesign.com/',
        tags: ['课程', 'VLSI'],
      },
    ],
  },

  {
    name: 'ACG',
    websites: [
      {
        name: 'Bangumi 番组计划',
        desc: '动画、漫画、游戏与书籍的收藏与评分社区',
        logo: '/img/website/bangumi_tv.png',
        href: 'https://bangumi.tv/',
        tags: ['番剧', '评分'],
      },
      {
        name: 'Bangumi.online',
        desc: '在线追番与番剧资源索引',
        logo: '/img/website/bangumi_online.png',
        href: 'https://bangumi.online/',
        tags: ['番剧', '资源'],
      },
      {
        name: 'VNDB',
        desc: '视觉小说 Visual Novel 数据库',
        logo: '/img/website/vndb_org.svg',
        href: 'https://vndb.org/',
        tags: ['Galgame', '数据库'],
      },
      {
        name: 'Nyaa',
        desc: '动漫、音乐与影视的 BT 资源站',
        logo: '/img/website/nyaa_si.svg',
        href: 'https://nyaa.si/',
        tags: ['资源', 'BT'],
      },
      {
        name: 'Yuc',
        desc: '新番放送时间表与追番日历',
        logo: '/img/website/yuc_wiki.png',
        href: 'https://yuc.wiki/',
        tags: ['番剧', '时间表'],
      },
      {
        name: 'TouchGAL',
        desc: 'Galgame 资源与资讯分享站',
        logo: '/img/website/touchgal_ink.png',
        href: 'https://www.touchgal.ink/',
        tags: ['Galgame', '资源'],
      },
      {
        name: 'AniList',
        desc: '动画与漫画收藏、评分与进度追踪',
        logo: '/img/website/anilist_co.svg',
        href: 'https://anilist.co/',
        tags: ['番剧', '评分'],
      },
      {
        name: 'MyAnimeList',
        desc: '老牌动画、漫画数据库与收藏追踪',
        logo: '/img/website/myanimelist_net.svg',
        href: 'https://myanimelist.net/',
        tags: ['番剧', '数据库'],
      },
      {
        name: '萌娘百科',
        desc: 'ACG 向的百科与角色资料库',
        logo: '/img/website/zh_moegirl_org_cn.png',
        href: 'https://zh.moegirl.org.cn/',
        tags: ['百科', 'ACG'],
      },
      {
        name: '哔哩哔哩',
        desc: '弹幕视频网站，新番与二次元内容聚集地',
        logo: '/img/website/bilibili_com.png',
        href: 'https://www.bilibili.com/',
        tags: ['视频', '番剧'],
      },
    ],
  },

  {
    name: '代码托管',
    websites: [
      {
        name: 'GitHub',
        desc: '全球最大的软件项目托管平台，发现优质开源项目',
        logo: '/img/website/github_com.svg',
        href: 'https://github.com/',
        tags: ['GitHub', '代码托管'],
      },
      {
        name: 'Gitlab',
        desc: '更快地交付安全代码，部署到任何云，并推动业务成果',
        logo: '/img/website/gitlab.png',
        href: 'https://gitlab.com/',
        tags: ['代码托管'],
      },
      {
        name: 'Bitbucket',
        desc: 'BitBucket 是一家源代码托管网站，采用Mercurial和Git作为分布式版本控制系统，同时提供商业计划和免费账户。',
        logo: '/img/website/bitbucket.png',
        href: 'https://bitbucket.org/',
        tags: ['代码托管'],
      },
    ],
  },

  {
    name: '工具',
    websites: [
		{
			name: 'Shields.io',
			desc: '为你的开源项目生成高质量小徽章图标',
			logo: '/img/website/shields.png',
			href: 'https://shields.io/',
			tags: ['图标', '首页'],
		},
		{
			name: '菜鸟工具',
			desc: '菜鸟工具，为开发设计人员提供在线工具，提供在线PHP、Python、 CSS、JS 调试，中文简繁体转换，进制转换等工具',
			logo: '/img/website/runoob.png',
			href: 'https://c.runoob.com/',
			tags: ['工具'],
		},
      {
        name: '在线工具',
        desc: '在线工具,开发人员工具,代码格式化、压缩、加密、解密,下载链接转换,ico图标制作,字帖生成',
        logo: '/img/website/tool_lu.png',
        href: 'https://tool.lu/',
        tags: ['工具'],
      },
      {
        name: 'ProcessOn',
        desc: '免费在线流程图思维导图',
        logo: '/img/website/processon_com.png',
        href: 'https://processon.com/',
        tags: ['工具', '思维导图'],
      },
      {
        name: 'Convertio',
        desc: '图片格式转换',
        logo: '/img/website/convertio.jpeg',
        href: 'https://convertio.co/',
        tags: [],
      },

      {
        name: 'AST Explorer',
        desc: '一个 Web 工具，用于探索由各种解析器生成的 AST 语法树',
        logo: '/img/website/astexplorer_net.png',
        href: 'https://astexplorer.net/',
        tags: ['工具', '格式转换'],
      },
      {
        name: 'transform',
        desc: '各类数据格式与对象转换',
        logo: '/img/website/transform_tools.png',
        href: 'https://transform.tools',
        tags: ['工具', '格式转换'],
      },
      {
        name: 'Hoppscotch',
        desc: '开源 API 开发生态系统',
        logo: '/img/website/hoppscotch.png',
        href: 'https://hoppscotch.io/',
        tags: ['api'],
      },
      {
        name: 'JsonT.run',
        desc: '一个简洁的在线 JSON 解析器',
        logo: '/img/website/jsont_run.ico',
        href: 'https://www.jsont.run/',
        tags: ['工具'],
      },
      {
        name: 'Apifox',
        desc: 'API 文档、API 调试、API Mock、API 自动化测试',
        logo: '/img/website/apifox.png',
        href: 'https://www.apifox.cn/',
        tags: ['工具'],
      },
    ],
  },

  {
    name: '网站托管',
    websites: [
      {
        name: 'Vercel',
        desc: 'Vercel将最好的开发人员体验与对最终用户性能的执着关注相结合',
        logo: '/img/website/vercel_com.png',
        href: 'https://vercel.com',
        tags: ['网站托管'],
      },
      {
        name: 'Netlify',
        desc: 'Netlify 是一家提供静态网站托管的云平台，支持从 Github, GitLab, Bitbucket 等代码仓库中自动拉取代码 然后进行项目打包和部署等功能',
        logo: '/img/website/netlify_com.svg',
        href: 'https://www.netlify.com',
        tags: ['网站托管'],
      },
      {
        name: 'Coolify',
        desc: '一个开源和自我托管的 Heroku/Netlify 替代品',
        logo: '/img/website/coolify.png',
        href: 'https://coolify.io',
        tags: ['网站托管'],
      },
      {
        name: 'GitHub Codespace',
        desc: '全球最大的软件项目托管平台，发现优质开源项目',
        logo: '/img/website/github_com.svg',
        href: 'https://github.com/codespaces',
        tags: ['网站托管'],
      },
      {
        name: 'railway',
        desc: '带上你的代码，剩下交给我们 ',
        logo: '/img/website/railway.png',
        href: 'https://railway.app/',
        tags: ['网站托管'],
      },

    ],
  },

  {
    name: '字体图标',
    websites: [
      {
        name: 'iconify',
        desc: '数千个图标，一个统一的框架',
        logo: '/img/website/icon_sets_iconify_design.svg',
        href: 'https://icon-sets.iconify.design/',
        tags: ['图标'],
      },
      {
        name: 'icones',
        desc: 'Icon Explorer with Instant searching, powered by Iconify',
        logo: '/img/website/icones_js_org.svg',
        href: 'https://icones.js.org/',
        tags: ['图标'],
      },
      {
        name: 'iconfont',
        desc: 'iconfont-国内功能很强大且图标内容很丰富的矢量图标库，提供矢量图标下载、在线存储、格式转换等功能',
        logo: '/img/website/iconfont_cn.svg',
        href: 'https://www.iconfont.cn/',
        tags: ['图标'],
      },
      {
        name: 'feathericons',
        desc: '简单美丽的开源图标',
        logo: '/img/website/feathericons_com.svg',
        href: 'https://feathericons.com/',
        tags: ['图标'],
      },
      {
        name: 'undraw',
        desc: '一个不断更新的设计项目与美丽的SVG图像，使用完全免费',
        logo: '/img/website/undraw_co.png',
        href: 'https://undraw.co/',
        tags: ['插画', 'svg'],
      },
      {
        name: 'igoutu',
        desc: '图标、插图、照片、音乐和设计工具',
        logo: '/img/website/igoutu.png',
        href: 'https://igoutu.cn/',
        tags: ['插画', 'svg'],
      },
      {
        name: 'Emojiall',
        desc: 'Emoji表情大全',
        logo: '/img/website/emojiall_com_152.png',
        href: 'https://www.emojiall.com/zh-hans',
        tags: ['图标', 'emoji'],
      },
      {
        name: '渐变色网站',
        desc: '数百万个自动生成的渐变的网站',
        logo: '/img/website/gradihunt_com.png',
        href: 'https://gradihunt.com/',
        tags: ['配色', '背景'],
      },
      {
        name: '谷歌字体',
        desc: '一个生成渐变色背景的网站',
        logo: '/img/website/google_fonts.svg',
        href: 'https://googlefonts.cn/',
        tags: ['字体'],
      },
    ],
  },

  {
    name: 'Github',
    websites: [
      {
        name: 'Gitstar Ranking',
        desc: '针对用户、组织和存储库的非官方 GitHub 星级排名',
        logo: '/img/website/github_com.svg',
        href: 'https://gitstar-ranking.com/',
        tags: [],
      },
      {
        name: 'Github主页 README 生成器',
        desc: '一个Github 个人主页 README 生成器',
        logo: '/img/website/github_com.svg',
        href: 'https://rahuldkjain.github.io/gh-profile-readme-generator/',
        tags: [],
      },
      {
        name: 'Github 统计生成器',
        desc: 'Github 在你的 README 中获取动态生成的 GitHub 统计信息！',
        logo: '/img/website/github_com.svg',
        href: 'https://github.com/anuraghazra/github-readme-stats',
        tags: [],
      },
    ],
  },

];
