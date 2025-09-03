import type { SplitResult, Split } from './split.ts'

export interface ParseResult {
  protocol?: Array<Node>
  hostname?: Array<Node>
  port?: string
  pathname?: Array<Node>
  searchParams?: URLSearchParams
}

// prettier-ignore
export type Parse<T extends string> =
  Split<T> extends infer S extends SplitResult ?
    {
      protocol: S['protocol'] extends string ? PartParse<S['protocol']> : undefined
      hostname: S['hostname'] extends string ? PartParse<S['hostname']> : undefined
      port: S['port'] extends string ? S['port'] : undefined
      pathname: S['pathname'] extends string ? PartParse<S['pathname']> : undefined
      searchParams: S['search'] extends string ? URLSearchParams : undefined
    } :
    never

export type Variable = { type: 'variable'; name: string }
export type Wildcard = { type: 'wildcard'; name?: string }
export type Enum = { type: 'enum'; members: readonly string[] }
export type Text = { type: 'text'; value: string }
export type Optional = { type: 'optional'; nodes: NodeList }

export type Node = Variable | Wildcard | Enum | Text | Optional
export type NodeList = Array<Node>

type PartParseState = {
  nodes: NodeList
  optionals: Array<NodeList>
  rest: string
}

type PartParse<T extends string> = _PartParse<{
  nodes: []
  optionals: []
  rest: T
}>

// prettier-ignore
type _PartParse<S extends PartParseState> =
  S extends { rest: `${infer Head}${infer Tail}` } ?
    Head extends ':' ?
      IdentiferParse<Tail> extends { identifier: infer name extends string, rest: infer rest extends string } ?
        (name extends '' ? never : _PartParse<AppendNode<S, { type: 'variable', name: name }, rest>>) :
      never : // this should never happen
    Head extends '*' ?
      IdentiferParse<Tail> extends { identifier: infer name extends string, rest: infer rest extends string } ?
        _PartParse<AppendNode<S, (name extends '' ? { type: 'wildcard' } : { type: 'wildcard', name: name }), rest>> :
      never : // this should never happen
    Head extends '{' ?
      Tail extends `${infer body}}${infer after}` ?
        _PartParse<AppendNode<S, { type: 'enum', members: EnumSplit<body> }, after>> :
      never : // unmatched `{`
    Head extends '}' ?
      never : // unmatched `}`
    Head extends '(' ?
      _PartParse<PushOptional<S, Tail>> :
    Head extends ')' ?
      PopOptional<S, Tail> extends infer next extends PartParseState ? _PartParse<next> : never : // unmatched `)` handled in PopOptional
    Head extends '\\' ?
      Tail extends `${infer L}${infer R}` ? _PartParse<AppendText<S, L, R>> :
      never : // dangling escape
    _PartParse<AppendText<S, Head, Tail>> :
  S['optionals'] extends [] ? S['nodes'] :
  never // unmatched `(`

// prettier-ignore
type AppendNode<S extends PartParseState, node extends Node, rest extends string> =
  S['optionals'] extends [...infer O extends Array<Array<Node>>, infer Top extends Array<Node>] ?
    {
      nodes: S['nodes']
      optionals: [...O, [...Top, node]]
      rest: rest
    } :
    {
      nodes: [...S['nodes'], node]
      optionals: S['optionals']
      rest: rest;
    }

// prettier-ignore
type AppendText<S extends PartParseState, text extends string, rest extends string> =
  S['optionals'] extends [...infer O extends Array<Array<Node>>, infer Top extends Array<Node>] ?
    (
      Top extends [...infer Nodes extends Array<Node>, { type: 'text', value: infer value extends string }] ?
        { nodes: S['nodes']; optionals: [...O, [...Nodes, { type: 'text', value: `${value}${text}` }]]; rest: rest } :
        { nodes: S['nodes']; optionals: [...O, [...Top, { type: 'text', value: text }]]; rest: rest }
    ) :
    (
      S['nodes'] extends [...infer Nodes extends Array<Node>, { type: 'text', value: infer value extends string }] ?
        { nodes: [...Nodes, { type: 'text', value: `${value}${text}` }]; optionals: S['optionals']; rest: rest } :
        { nodes: [...S['nodes'], { type: 'text', value: text }]; optionals: S['optionals']; rest: rest }
    )

// Optional stack helpers ---------------------------------------------------------------------------

type PushOptional<S extends PartParseState, rest extends string> = {
  nodes: S['nodes']
  optionals: [...S['optionals'], []]
  rest: rest
}

// If stack is empty -> unmatched ')', return never
// Else pop and wrap nodes into an Optional node; append to parent or part
type PopOptional<S extends PartParseState, R extends string> = S['optionals'] extends [
  ...infer O extends Array<Array<Node>>,
  infer Top extends Array<Node>,
]
  ? O extends [...infer OO extends Array<Array<Node>>, infer Parent extends Array<Node>]
    ? {
        nodes: S['nodes']
        optionals: [...OO, [...Parent, { type: 'optional'; nodes: Top }]]
        rest: R
      }
    : { nodes: [...S['nodes'], { type: 'optional'; nodes: Top }]; optionals: []; rest: R }
  : never

// Identifier --------------------------------------------------------------------------------------

// prettier-ignore
type _a_z = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
type _A_Z = Uppercase<_a_z>
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

type IdentifierHead = _a_z | _A_Z | '_' | '$'
type IdentifierTail = IdentifierHead | _0_9

type IdentiferParse<T extends string> = _IdentifierParse<{ identifier: ''; rest: T }>

// prettier-ignore
type _IdentifierParse<S extends { identifier: string, rest: string }> =
  S extends { identifier: '', rest: `${infer Head extends IdentifierHead}${infer Tail}` } ?
    _IdentifierParse<{ identifier: Head, rest: Tail }> :
    S extends { identifier: string, rest: `${infer Head extends IdentifierTail}${infer Tail}`} ?
      _IdentifierParse<{ identifier: `${S['identifier']}${Head}`, rest: Tail }> :
      S

// Enum --------------------------------------------------------------------------------------------

// prettier-ignore
type EnumSplit<Body extends string> =
  Body extends `${infer Member},${infer Rest}` ? [Member, ...EnumSplit<Rest>] :
  [Body]
