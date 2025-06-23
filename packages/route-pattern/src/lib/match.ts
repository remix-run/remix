import { toRegExp } from './ast.ts';
import { parseProtocol, parseHostname, parsePathname } from './parse.ts';
import { split } from './split.ts';

export function createMatcher(patterns: Array<string>) {
  const blahs = patterns.map((pattern) => {
    const s = split(pattern);
    const protocol = s.protocol === undefined ? undefined : parseProtocol(s.protocol);
    const hostname = s.hostname === undefined ? undefined : parseHostname(s.hostname);
    const pathname = s.pathname === undefined ? undefined : parsePathname(s.pathname);

    const regexs = {
      protocol: protocol === undefined ? /.*/ : toRegExp(protocol),
      hostname: hostname === undefined ? /.*/ : toRegExp(hostname, /[^.]*/),
      pathname: pathname === undefined ? /^\/$/ : toRegExp(pathname, /[^/]*/),
    };
    return { pattern, regexs };
  });

  const match = function (url: string | URL) {
    const matches: Array<{ pattern: string; params: Record<string, string | undefined> }> = [];
    if (typeof url === 'string') {
      url = new URL(url);
    }
    for (const blah of blahs) {
      const protocol = blah.regexs.protocol.exec(url.protocol);
      const hostname = blah.regexs.hostname.exec(url.hostname);
      const pathname = blah.regexs.pathname.exec(url.pathname);
      if (protocol === null || hostname === null || pathname === null) {
        continue;
      }
      matches.push({ pattern: blah.pattern, params: { ...hostname.groups, ...pathname.groups } });
    }
    return matches;
  };
  return { match };
}
