type BaseNode =
  | { type: 'text'; value: string }
  | { type: 'param'; name?: string }
  | { type: 'glob'; name?: string };
export type Optional = { type: 'optional'; nodes: Array<BaseNode> };
export type Node = BaseNode | Optional;

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
