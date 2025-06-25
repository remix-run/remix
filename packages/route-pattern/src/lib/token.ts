export type Token = { span: [number, number] } & (
  | { type: 'text'; value: string }
  | { type: 'param'; name?: string }
  | { type: 'glob'; name?: string }
  | { type: '(' | ')' }
);
