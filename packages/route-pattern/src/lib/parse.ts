import type { Node, Optional } from './ast.ts';
import { lexHostname, lexPathname, lexProtocol } from './lex.ts';
import type { Token } from './token.ts';

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
      (optional?.node.nodes ?? nodes).push(token);
    }
  }
  if (optional) {
    throw new Error(`Unbalanced paren at index: ${optional.index}`);
  }
  return nodes;
}

export function parseProtocol(source: string) {
  return parseOptionals(lexProtocol(source));
}

export function parseHostname(source: string) {
  return parseOptionals(lexHostname(source));
}

export function parsePathname(source: string) {
  return parseOptionals(lexPathname(source));
}
