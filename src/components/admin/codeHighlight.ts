/* eslint-disable @typescript-eslint/no-var-requires, global-require */
import Prism from 'prism-react-renderer/prism';

// Prism language components attach to the renderer's Prism instance.
const LOADERS: Array<() => unknown> = [
  () => require('prismjs/components/prism-markup-templating'),
  () => require('prismjs/components/prism-c'),
  () => require('prismjs/components/prism-cpp'),
  () => require('prismjs/components/prism-csharp'),
  () => require('prismjs/components/prism-objectivec'),
  () => require('prismjs/components/prism-java'),
  () => require('prismjs/components/prism-kotlin'),
  () => require('prismjs/components/prism-scala'),
  () => require('prismjs/components/prism-go'),
  () => require('prismjs/components/prism-rust'),
  () => require('prismjs/components/prism-ruby'),
  () => require('prismjs/components/prism-php'),
  () => require('prismjs/components/prism-perl'),
  () => require('prismjs/components/prism-lua'),
  () => require('prismjs/components/prism-r'),
  () => require('prismjs/components/prism-dart'),
  () => require('prismjs/components/prism-swift'),
  () => require('prismjs/components/prism-powershell'),
  () => require('prismjs/components/prism-typescript'),
  () => require('prismjs/components/prism-jsx'),
  () => require('prismjs/components/prism-tsx'),
  () => require('prismjs/components/prism-json'),
  () => require('prismjs/components/prism-yaml'),
  () => require('prismjs/components/prism-toml'),
  () => require('prismjs/components/prism-ini'),
  () => require('prismjs/components/prism-bash'),
  () => require('prismjs/components/prism-python'),
  () => require('prismjs/components/prism-sql'),
  () => require('prismjs/components/prism-diff'),
  () => require('prismjs/components/prism-docker'),
  () => require('prismjs/components/prism-nginx'),
  () => require('prismjs/components/prism-http'),
  () => require('prismjs/components/prism-regex'),
  () => require('prismjs/components/prism-makefile'),
  () => require('prismjs/components/prism-cmake'),
  () => require('prismjs/components/prism-git'),
  () => require('prismjs/components/prism-graphql'),
  () => require('prismjs/components/prism-less'),
  () => require('prismjs/components/prism-sass'),
  () => require('prismjs/components/prism-scss'),
  () => require('prismjs/components/prism-markdown'),
  () => require('prismjs/components/prism-matlab'),
  () => require('prismjs/components/prism-properties'),
  () => require('prismjs/components/prism-verilog'),
  () => require('prismjs/components/prism-vhdl'),
  () => require('prismjs/components/prism-tcl'),
];

const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
  cs: 'csharp',
  'c#': 'csharp',
  objc: 'objectivec',
  dockerfile: 'docker',
  sv: 'verilog',
  systemverilog: 'verilog',
  'system-verilog': 'verilog',
  hdl: 'verilog',
  v: 'verilog',
  vhd: 'vhdl',
  ps1: 'powershell',
  pwsh: 'powershell',
  rs: 'rust',
  golang: 'go',
  kt: 'kotlin',
  rb: 'ruby',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  make: 'makefile',
};

let ready = false;

function ensureLanguages() {
  if (ready) return;
  ready = true;
  const scope = globalThis as unknown as {Prism?: unknown};
  const previous = scope.Prism;
  scope.Prism = Prism;
  try {
    for (const load of LOADERS) {
      try {
        load();
      } catch {
        // ignore a single unavailable language
      }
    }
  } finally {
    if (previous === undefined) delete scope.Prism;
    else scope.Prism = previous;
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (!Prism.languages[alias] && Prism.languages[target]) {
      Prism.languages[alias] = Prism.languages[target];
    }
  }
  if (Prism.languages.tcl && !Prism.languages.tcl['vcformal-command']) {
    Prism.languages.insertBefore('tcl', 'keyword', {
      'vcformal-command': {
        pattern: /(^[\t ]*)(?:analyze|check_fv|compute_formal_core|compute_proof_assist|compute_reduced_constraints|elaborate|report_formal_core|report_fv|report_proof_assist|report_reduced_constraints|run_fv|view_trace)\b/m,
        lookbehind: true,
        alias: 'function',
      },
    });
  }
}

export function registerCodeLanguages() {
  ensureLanguages();
}

const cache = new Map<string, string>();
const MAX_CACHE = 400;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalize(language: string | undefined): string {
  const key = String(language || '').toLowerCase().trim().split(/\s+/)[0];
  if (!key || key === 'plain' || key === 'plaintext' || key === 'none' || key === 'text' || key === 'txt') return '';
  if (Prism.languages[key]) return key;
  const alias = ALIASES[key];
  return alias && Prism.languages[alias] ? alias : '';
}

export function highlightToHtml(code: string, language?: string): string {
  ensureLanguages();
  const key = normalize(language);
  if (!key) return escapeHtml(code);
  const cacheKey = `${key}\u0000${code}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  let html: string;
  try {
    html = Prism.highlight(code, Prism.languages[key], key);
  } catch {
    html = escapeHtml(code);
  }
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(cacheKey, html);
  return html;
}

export function languageFromClassName(className: unknown): string | undefined {
  const value = Array.isArray(className) ? className.join(' ') : String(className || '');
  const match = /language-([\w+#-]+)/i.exec(value);
  return match ? match[1] : undefined;
}
