import type { Split } from './split.types.ts'

export type Ast = {
  protocol?: Array<PartNode>
  hostname?: Array<PartNode>
  port?: string
  pathname?: Array<PartNode>
}

export type Parse<T extends string> =
  Split<T> extends infer split extends {
    protocol?: string
    hostname?: string
    port?: string
    pathname?: string
  }
    ? {
        protocol: split['protocol'] extends string ? PartParse<split['protocol']> : undefined
        hostname: split['hostname'] extends string ? PartParse<split['hostname']> : undefined
        port: split['port'] extends string ? split['port'] : undefined
        pathname: split['pathname'] extends string ? PartParse<split['pathname']> : undefined
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
  optional: Optional | null
  rest: string
}

type PartParse<source extends string> = _PartParse<{
  part: []
  optional: null
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
        state extends { optional: Optional } ? never : // nested optional
        _PartParse<{ part: state['part'], optional: { type: 'optional', nodes: [] }, rest: rest }> :
      char extends ')' ?
        state extends { optional: infer optional extends Optional } ?
          _PartParse<{ part: [...state['part'], optional], optional: null, rest: rest }> :
        never : // unmatched `)`
      char extends '\\' ?
        rest extends `${infer next}${infer after}` ? _PartParse<AppendText<state, next, after>> :
        never : // dangling escape
      _PartParse<AppendText<state, char, rest>>
    :
    state extends { optional: Optional} ? never : // unmatched `(`
    state['part']

// prettier-ignore
type AppendNode<state extends PartParseState, node extends PartNode, rest extends string> =
  state extends { optional: infer optional extends Optional } ?
    {
      part: state['part']
      optional: { type: 'optional', nodes: [...optional['nodes'], node]}
      rest: rest
    } :
    {
      part: [...state['part'], node]
      optional: null
      rest: rest;
    }

// prettier-ignore
type AppendText<state extends PartParseState, text extends string, rest extends string> =
  state extends { optional: Optional } ?
    {
      part: state['part']
      optional: state['optional']['nodes'] extends [...infer nodes extends Array<PartNode>, { type: 'text', value: infer value extends string }] ?
        { type: 'optional', nodes: [...nodes, { type: 'text', value: `${value}${text}`}] } :
        { type: 'optional', nodes: [...state['optional']['nodes'], { type: 'text', value: text }] }
      rest: rest;
    } :
    {
      part: state['part'] extends [...infer nodes extends Array<PartNode>, { type: 'text', value: infer value extends string }] ?
        [...nodes, { type: 'text', value: `${value}${text}`}] :
        [...state['part'], { type: 'text', value: text }]
      optional: state['optional']
      rest: rest;
    }

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
