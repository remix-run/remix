import { split } from './split.ts';

export type Ast = {
  protocol?: Part;
  hostname?: Part;
  pathname?: Part;
  search?: URLSearchParams;
};

export type Part = Array<Node>;

type Text = { type: 'text'; value: string };
type Param = { type: 'param'; name?: string };
type Glob = { type: 'glob'; name?: string };
type Enum = { type: 'enum'; members: Array<string> };
type Optional = { type: 'optional'; nodes: Array<Node> };
type Node = Text | Param | Glob | Enum | Optional;

export function parse(source: string) {
  const { protocol, hostname, pathname, search } = split(source);
  const ast: Ast = {};
  if (protocol) ast.protocol = parsePart(source, protocol);
  if (hostname) ast.hostname = parsePart(source, hostname);
  if (pathname) ast.pathname = parsePart(source, pathname);
  if (search) ast.search = new URLSearchParams(source.slice(...search));
  return ast;
}

const identifierRE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/;

function parsePart(source: string, bounds: [number, number]) {
  const part = source.slice(...bounds);

  const ast: Part = [];
  let optional: { node: Optional; index: number } | null = null;

  const nodes = () => optional?.node.nodes ?? ast;
  const appendText = (text: string) => {
    const last = nodes().at(-1);
    if (last?.type !== 'text') {
      nodes().push({ type: 'text', value: text });
      return;
    }
    last.value += text;
  };

  let i = 0;
  while (i < part.length) {
    const char = part[i];

    // param
    if (char === ':') {
      i += 1;
      const node: Param = { type: 'param' };
      const name = identifierRE.exec(part.slice(i))?.[0];
      if (name) node.name = name;
      nodes().push(node);
      i += name?.length ?? 0;
      continue;
    }

    // glob
    if (char === '*') {
      i += 1;
      const node: Glob = { type: 'glob' };
      const name = identifierRE.exec(part.slice(i))?.[0];
      if (name) node.name = name;
      nodes().push(node);
      i += name?.length ?? 0;
      continue;
    }

    // enum
    if (char === '{') {
      const close = part.indexOf('}', i);
      if (close === -1) throw new Error(`unmatched { at ${i}`);
      const members = part.slice(i + 1, close).split(',');
      nodes().push({ type: 'enum', members });
      i = close + 1;
      continue;
    }
    if (char === '}') {
      throw new Error(`unmatched } at ${i}`);
    }

    // optional
    if (char === '(') {
      if (optional) throw new Error(`nested ( at ${optional.index} ${i}`);
      optional = { node: { type: 'optional', nodes: [] }, index: i };
      i += 1;
      continue;
    }
    if (char === ')') {
      if (!optional) throw new Error(`unmatched ) at ${i}`);
      ast.push(optional.node);
      optional = null;
      i += 1;
      continue;
    }

    // text
    if (char === '\\') {
      const next = part.at(i + 1);
      if (!next) throw new Error(`dangling escape at ${i}`);
      appendText(next);
      i += 2;
      continue;
    }
    appendText(char);
    i += 1;
  }
  if (optional) throw new Error(`unmatched ( at ${optional.index}`);
  return ast;
}
