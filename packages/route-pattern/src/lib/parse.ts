import type { Node, Optional } from './ast.ts';
import { lexHostname, lexPathname, lexProtocol } from './lex.ts';
import type { Token } from './token.ts';
import { split } from './split.ts';

type Pattern = {
  protocol?: Array<Node>;
  hostname?: Array<Node>;
  pathname?: Array<Node>;
  search?: URLSearchParams;
};

export function parse(source: string) {
  const { protocol, hostname, pathname, search } = split(source);

  const pattern: Pattern = {};
  if (protocol) pattern.protocol = parseOptionals(lexProtocol(protocol));
  if (hostname) pattern.hostname = parseOptionals(lexHostname(hostname));
  if (pathname) pattern.pathname = parseOptionals(lexPathname(pathname));
  if (search) pattern.search = new URLSearchParams(search);
  return pattern;
}

function parseOptionals(tokens: Iterable<Token>) {
  const nodes: Array<Node> = [];

  let optional: { node: Optional; index: number } | null = null;
  for (const token of tokens) {
    if (token.type === '(') {
      if (optional) {
        throw new Error(`Nested paren at index: ${optional.index} ${token.span[0]}`);
      }
      optional = { node: { type: 'optional', nodes: [] }, index: token.span[0] };
      continue;
    }
    if (token.type === ')') {
      if (!optional) {
        throw new Error(`Unbalanced paren at index: ${token.span[0]}`);
      }
      nodes.push(optional.node);
      optional = null;
      continue;
    }

    if (token.type === 'text' || token.type === 'param' || token.type === 'glob') {
      const { span, ...node } = token;
      (optional?.node.nodes ?? nodes).push(node);
    }
  }
  if (optional) {
    throw new Error(`Unbalanced paren at index: ${optional.index}`);
  }
  return nodes;
}
