function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function resolveMarkdownTarget(sourcePath, href) {
  const clean = String(href || '').trim().replace(/^<|>$/g, '');
  if (!clean || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(clean)) return null;

  const suffixMatch = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(clean);
  if (!suffixMatch) return null;
  const rawPath = suffixMatch[1];
  if (!/\.mdx?$/i.test(rawPath)) return null;

  let decoded = decodePath(rawPath);
  if (decoded === null) return null;
  decoded = decoded.replace(/\\/g, '/');

  let parts;
  if (/^\/?docs\//i.test(decoded)) {
    parts = decoded.replace(/^\//, '').split('/');
  } else if (/^\/?blog\//i.test(decoded)) {
    parts = decoded.replace(/^\//, '').split('/');
  } else if (decoded.startsWith('/')) {
    return null;
  } else {
    parts = sourcePath.replace(/\\/g, '/').split('/').slice(0, -1);
    for (const part of decoded.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (parts.length <= 1) return null;
        parts.pop();
      } else {
        parts.push(part);
      }
    }
  }

  const target = parts.join('/');
  if (!/^(?:docs|blog)\/.+$/i.test(target) || target.split('/').some((part) => part === '..')) return null;
  const routePath = target
    .replace(/\.(?:md|mdx)$/i, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const route = target.toLowerCase().startsWith('docs/') ? `/docs/${routePath.slice(5)}` : `/${routePath}`;
  return `${route}${suffixMatch[2] || ''}${suffixMatch[3] || ''}`;
}

function replaceLinkTarget(target, sourcePath) {
  const leading = target.startsWith('<') && target.endsWith('>');
  const normalized = resolveMarkdownTarget(sourcePath, target);
  if (!normalized) return target;
  return leading ? `<${normalized}>` : normalized;
}

export function fixMarkdownLinks(source, sourcePath) {
  const text = String(source || '');
  if (!/^(?:docs|blog)\/.+\.(?:md|mdx)$/i.test(String(sourcePath || ''))) return text;

  return text
    .replace(/(!?\[[^\]]*\]\()(<[^>\r\n]+>|(?:\\.|[^\s)])+)(\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?(\))/g,
      (_match, prefix, target, title = '', suffix) => `${prefix}${replaceLinkTarget(target, sourcePath)}${title}${suffix}`)
    .replace(/(^\s*\[[^\]]+\]:\s*)(<[^>\r\n]+>|\S+)(.*$)/gm,
      (_match, prefix, target, tail) => `${prefix}${replaceLinkTarget(target, sourcePath)}${tail}`)
    .replace(/(\bhref\s*=\s*["'])([^"']+)(["'])/gi,
      (_match, prefix, target, suffix) => `${prefix}${replaceLinkTarget(target, sourcePath)}${suffix}`);
}
