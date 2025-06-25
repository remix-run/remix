type BaseNode =
  | { type: 'text'; value: string }
  | { type: 'param'; name?: string }
  | { type: 'glob'; name?: string };
export type Optional = { type: 'optional'; nodes: Array<BaseNode> };
export type Node = BaseNode | Optional;
