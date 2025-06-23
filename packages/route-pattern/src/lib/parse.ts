import { lexHostname, lexPathname, lexProtocol, type Token } from './tokenize.ts';

type Optional = { type: 'optional'; nodes: Array<Token>; span: [number, number] };
type Node = Token | Optional;

function parseOptionals(tokens: Iterable<Token>) {
  const nodes: Array<Node> = [];

  let optional: Optional | null = null;
  for (const token of tokens) {
    if (token.type === '(') {
      if (optional) {
        throw new Error(`Nested paren: ${optional.span[0]} ${token.span[0]}`);
      }
      optional = { type: 'optional', nodes: [], span: token.span };
      continue;
    }
    if (token.type === ')') {
      if (!optional) {
        throw new Error(`Unbalanced paren: ${token.span[0]}`);
      }
      optional.span[1] = optional.nodes.reduce((acc, node) => acc + node.span[1], 0) + 2;
      nodes.push(optional);
      optional = null;
      continue;
    }
    (optional?.nodes ?? nodes).push(token);
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
