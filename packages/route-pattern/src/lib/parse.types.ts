import type { Split } from './split.types.ts'

export interface Ast {
  protocol?: Array<PartNode>
  hostname?: Array<PartNode>
  port?: string
  pathname?: Array<PartNode>
  searchParams?: URLSearchParams
}

export type Parse<T extends string> =
  Split<T> extends infer S extends {
    protocol?: string
    hostname?: string
    port?: string
    pathname?: string
    search?: string
  }
    ? {
        protocol: S['protocol'] extends string ? PartParse<S['protocol']> : undefined
        hostname: S['hostname'] extends string ? PartParse<S['hostname']> : undefined
        port: S['port'] extends string ? S['port'] : undefined
        pathname: S['pathname'] extends string ? PartParse<S['pathname']> : undefined
        searchParams: S['search'] extends string ? URLSearchParams : undefined
      }
    : never

// Part --------------------------------------------------------------------------------------------

export type Part = Array<PartNode>

type Variable = { type: 'variable'; name: string }
type Wildcard = { type: 'wildcard'; name?: string }
type Enum = { type: 'enum'; members: readonly string[] }
type Text = { type: 'text'; value: string }
type Optional = { type: 'optional'; nodes: Array<PartNode> }

export type PartNode<Key extends keyof _PartNode = keyof _PartNode> = _PartNode[Key]
type _PartNode = {
  variable: Variable
  wildcard: Wildcard
  enum: Enum
  text: Text
  optional: Optional
}

type PartParseState = {
  part: Array<PartNode>
  optionals: Array<Array<PartNode>>
  rest: string
}

type PartParse<source extends string> = _PartParse<{
  part: []
  optionals: []
  rest: source
}>

// prettier-ignore
type _PartParse<state extends PartParseState> =
    state extends { rest: `${infer char}${infer rest}` } ?
      char extends ':' ?
        IdentiferParse<rest> extends { identifier: infer name extends string, rest: infer rest extends string } ?
          (name extends '' ? never : _PartParse<AppendNode<state, { type: 'variable', name: name }, rest>>) :
        never : // this should never happen
      char extends '*' ?
        IdentiferParse<rest> extends { identifier: infer name extends string, rest: infer rest extends string } ?
          _PartParse<AppendNode<state, (name extends '' ? { type: 'wildcard' } : { type: 'wildcard', name: name }), rest>> :
        never : // this should never happen
      char extends '{' ?
        rest extends `${infer body}}${infer after}` ? _PartParse<AppendNode<state, { type: 'enum', members: EnumSplit<body> }, after>> :
        never : // unmatched `{`
      char extends '}' ? never : // unmatched `}`
      char extends '(' ?
        _PartParse<PushOptional<state, rest>> :
      char extends ')' ?
        PopOptional<state, rest> extends infer next extends PartParseState ? _PartParse<next> : never : // unmatched `)` handled in PopOptional
      char extends '\\' ?
        rest extends `${infer next}${infer after}` ? _PartParse<AppendText<state, next, after>> :
        never : // dangling escape
      _PartParse<AppendText<state, char, rest>>
    :
    state['optionals'] extends [] ?
    state['part']
    : never // unmatched `(`

// prettier-ignore
type AppendNode<state extends PartParseState, node extends PartNode, rest extends string> =
  state['optionals'] extends [...infer O extends Array<Array<PartNode>>, infer Top extends Array<PartNode>] ?
    {
      part: state['part']
      optionals: [...O, [...Top, node]]
      rest: rest
    } :
    {
      part: [...state['part'], node]
      optionals: state['optionals']
      rest: rest;
    }

// prettier-ignore
type AppendText<state extends PartParseState, text extends string, rest extends string> =
  state['optionals'] extends [...infer O extends Array<Array<PartNode>>, infer Top extends Array<PartNode>] ?
    (
      Top extends [...infer Nodes extends Array<PartNode>, { type: 'text', value: infer value extends string }] ?
        { part: state['part']; optionals: [...O, [...Nodes, { type: 'text', value: `${value}${text}` }]]; rest: rest } :
        { part: state['part']; optionals: [...O, [...Top, { type: 'text', value: text }]]; rest: rest }
    ) :
    (
      state['part'] extends [...infer Nodes extends Array<PartNode>, { type: 'text', value: infer value extends string }] ?
        { part: [...Nodes, { type: 'text', value: `${value}${text}` }]; optionals: state['optionals']; rest: rest } :
        { part: [...state['part'], { type: 'text', value: text }]; optionals: state['optionals']; rest: rest }
    )

// Optional stack helpers ---------------------------------------------------------------------------

type PushOptional<state extends PartParseState, rest extends string> = {
  part: state['part']
  optionals: [...state['optionals'], []]
  rest: rest
}

// If stack is empty -> unmatched ')', return never
// Else pop and wrap nodes into an Optional node; append to parent or part
type PopOptional<state extends PartParseState, rest extends string> = state['optionals'] extends [
  ...infer O extends Array<Array<PartNode>>,
  infer Top extends Array<PartNode>,
]
  ? O extends [...infer OO extends Array<Array<PartNode>>, infer Parent extends Array<PartNode>]
    ? {
        part: state['part']
        optionals: [...OO, [...Parent, { type: 'optional'; nodes: Top }]]
        rest: rest
      }
    : { part: [...state['part'], { type: 'optional'; nodes: Top }]; optionals: []; rest: rest }
  : never

// Identifier --------------------------------------------------------------------------------------

// prettier-ignore
type _a_z = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
type _A_Z = Uppercase<_a_z>
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

type IdentifierHead = _a_z | _A_Z | '_' | '$'
type IdentifierTail = IdentifierHead | _0_9

type IdentiferParse<text extends string> = _IdentifierParse<{ identifier: ''; rest: text }>

// prettier-ignore
type _IdentifierParse<state extends { identifier: string, rest: string }> =
    state extends { identifier: '', rest: `${infer char extends IdentifierHead}${infer rest}` } ?
      _IdentifierParse<{ identifier: char, rest: rest}> :
    state extends { identifier: string, rest: `${infer char extends IdentifierTail}${infer rest}`} ?
      _IdentifierParse<{ identifier: `${state['identifier']}${char}`, rest: rest }> :
    state

// Enum --------------------------------------------------------------------------------------------

// prettier-ignore
type EnumSplit<Body extends string> =
  Body extends `${infer Member},${infer Rest}` ? [Member, ...EnumSplit<Rest>] :
  [Body]
