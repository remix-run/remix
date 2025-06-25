import type { Node } from './ast.ts';
import { parse } from './parse/parse.ts';

export function createMatcher(sources: Array<string>) {
  const patterns = sources.map((source) => {
    const { protocol, hostname, pathname } = parse(source);

    const regexs = {
      protocol: protocol === undefined ? /.*/ : toRegExp(protocol),
      hostname: hostname === undefined ? /.*/ : toRegExp(hostname, /[^.]*/),
      pathname: pathname === undefined ? /^\/$/ : toRegExp(pathname, /[^/]*/),
    };
    return { pattern: source, regexs };
  });

  const match = function (url: string | URL) {
    const matches: Array<{ pattern: string; params: Record<string, string | undefined> }> = [];
    if (typeof url === 'string') {
      url = new URL(url);
    }
    for (const { pattern, regexs } of patterns) {
      const protocol = regexs.protocol.exec(url.protocol);
      const hostname = regexs.hostname.exec(url.hostname);
      const pathname = regexs.pathname.exec(url.pathname);
      if (protocol === null || hostname === null || pathname === null) {
        continue;
      }
      matches.push({ pattern, params: { ...hostname.groups, ...pathname.groups } });
    }
    return matches;
  };
  return { match };
}

export function toRegExp(part: Array<Node>, paramRegExp?: RegExp) {
  const source = toRegExpSource(part, paramRegExp);
  return new RegExp(source);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRegExpSource(part: Array<Node>, paramRegExp?: RegExp) {
  const source: string = part
    .map((node) => {
      if (node.type === 'param') {
        if (!paramRegExp) {
          throw new Error('Unexpected param');
        }
        let source = '(';
        if (node.name) {
          source += `?<${node.name}>`;
        }
        source += paramRegExp.source;
        source += ')';
        return source;
      }
      if (node.type === 'glob') {
        let source = '(';
        if (node.name) {
          source += `?<${node.name}>`;
        }
        source += '.*)';
        return source;
      }
      if (node.type === 'optional') {
        return `(?:${toRegExpSource(node.nodes, paramRegExp)})?`;
      }
      if (node.type === 'text') {
        return escape(node.value);
      }
    })
    .join('');
  return source;
}
