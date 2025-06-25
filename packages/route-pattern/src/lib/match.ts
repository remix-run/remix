import type { Node } from './ast.ts';
import { parse } from './parse.ts';

type Params = Record<string, string | undefined>;
type Constraint = (url: URL) => Params | null;

export function createMatcher(sources: Array<string>) {
  const patterns = sources.map((source) => {
    const { protocol, hostname, pathname } = parse(source);

    const protocolRE = protocol === undefined ? /^.*$/ : toRegExp(protocol);
    const hostnameRE = hostname === undefined ? /^.*$/ : toRegExp(hostname, { param: /[^.]*/ });
    const pathnameRE = pathname === undefined ? /^\/$/ : toRegExp(pathname, { param: /[^/]*/ });

    const constraints: Array<Constraint> = [
      (url) => (protocolRE.test(url.protocol) ? {} : null),
      (url) => {
        const match = hostnameRE.exec(url.hostname);
        if (!match) return null;
        return match.groups ?? {};
      },
      (url) => {
        const match = pathnameRE.exec(url.pathname.slice(1));
        if (!match) return null;
        return match.groups ?? {};
      },
    ];

    return { pattern: source, constraints };
  });

  const match = function (url: string | URL) {
    if (typeof url === 'string') url = new URL(url);

    const matches: Array<{ pattern: string; params: Record<string, string | undefined> }> = [];
    for (const { pattern, constraints } of patterns) {
      let isMatch = true;
      const params: Params = {};
      for (const constraint of constraints) {
        const result = constraint(url);
        if (result === null) {
          isMatch = false;
          break;
        }
        Object.assign(params, result);
      }
      if (!isMatch) continue;
      matches.push({ pattern, params });
    }
    return matches;
  };
  return { match };
}

export function toRegExp(part: Array<Node>, options?: { param: RegExp }) {
  const source = toRegExpSource(part, options?.param);
  return new RegExp('^' + source + '$');
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
