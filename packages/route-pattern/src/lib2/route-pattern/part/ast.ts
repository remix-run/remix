export type AST = {
  tokens: Array<Token>
  paramNames: Array<string>
  optionals: Map<number, number>
}

type Token =
  | { type: 'text'; text: string }
  | { type: '(' | ')' }
  | { type: ':'; nameIndex: number }
  | { type: '*'; nameIndex?: number }
