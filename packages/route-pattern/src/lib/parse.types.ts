export type Ast = {
  protocol?: Array<Node>;
  hostname?: Array<Node>;
  pathname?: Array<Node>;
};

export type Parse<source extends string> =
  SplitUrl<source> extends infer split extends {
    protocol?: string;
    hostname?: string;
    pathname?: string;
  }
    ? {
        protocol: split['protocol'] extends string ? PartParse<split['protocol']> : undefined;
        hostname: split['hostname'] extends string ? PartParse<split['hostname']> : undefined;
        pathname: split['pathname'] extends string ? PartParse<split['pathname']> : undefined;
      }
    : never;

// SplitUrl ----------------------------------------------------------------------------------------

type SplitUrl<source extends string> = OmitEmptyStringValues<_SplitUrl<source>>;

// prettier-ignore
type _SplitUrl<source extends string> =
  source extends `${infer before}?${infer search}` ? _SplitUrl<before> & { search: search } :
  source extends `${infer protocol}://${infer after}` ?
    protocol extends `${string}/${string}` ? { pathname: source } :
    after extends `${infer hostname}/${infer pathname}` ? { protocol: protocol; hostname: hostname; pathname: pathname } :
    { protocol: protocol; hostname: after } :
  { pathname: source };

type OmitEmptyStringValues<S> = { [K in keyof S as S[K] extends '' ? never : K]: S[K] };

// Part --------------------------------------------------------------------------------------------

export type Part = Array<Node>;

export type Node = Param | Glob | Enum | Text | Optional;

export type Param = { type: 'param'; name?: string };
export type Glob = { type: 'glob'; name?: string };
export type Enum = { type: 'enum'; members: Array<string> };
export type Text = { type: 'text'; value: string };
export type Optional = { type: 'optional'; nodes: Array<Node> };

type PartParseState = {
  ast: Array<Node>;
  optional: Optional | null;
  rest: string;
};

type PartParse<source extends string> = _PartParse<{
  ast: [];
  optional: null;
  rest: source;
}>;

// prettier-ignore
type _PartParse<state extends PartParseState> =
    state extends { rest: `${infer char}${infer rest}` } ?
      char extends ':' ?
        IdentiferParse<rest> extends { identifier: infer name extends string, rest: infer rest extends string } ?
          _PartParse<AppendNode<state, { type: 'param', name: name }, rest>> :
        never : // this should never happen
      char extends '*' ?
        IdentiferParse<rest> extends { identifier: infer name extends string, rest: infer rest extends string } ?
          _PartParse<AppendNode<state, { type: 'glob', name: name }, rest>> :
        never : // this should never happen
      char extends '{' ?
        rest extends `${infer body}}${infer after}` ? _PartParse<AppendNode<state, { type: 'enum', members: EnumSplit<body> }, after>> :
        never : // unmatched `{`
      char extends '}' ? never : // unmatched `}`
      char extends '(' ?
        state extends { optional: Optional } ? never : // nested optional
        _PartParse<{ ast: state['ast'], optional: { type: 'optional', nodes: [] }, rest: rest }> :
      char extends ')' ?
        state extends { optional: infer optional extends Optional } ?
          _PartParse<{ ast: [...state['ast'], optional], optional: null, rest: rest }> :
        never : // unmatched `)`
      char extends '\\' ?
        rest extends `${infer next}${infer after}` ? _PartParse<AppendText<state, next, after>> :
        never : // dangling escape
      _PartParse<AppendText<state, char, rest>>
    :
    state extends { optional: Optional} ? never : // unmatched `(`
    state['ast']

// prettier-ignore
type AppendNode<state extends PartParseState, node extends Node, rest extends string> =
  state extends { optional: infer optional extends Optional } ?
    {
      ast: state['ast']
      optional: { type: 'optional', nodes: [...optional['nodes'], node]}
      rest: rest
    } :
    {
      ast: [...state['ast'], node]
      optional: null
      rest: rest;
    }

// prettier-ignore
type AppendText<state extends PartParseState, text extends string, rest extends string> =
  state extends { optional: Optional } ?
    {
      ast: state['ast']
      optional: state['optional']['nodes'] extends [...infer nodes extends Array<Node>, { type: 'text', value: infer value extends string }] ?
        { type: 'optional', nodes: [...nodes, { type: 'text', value: `${value}${text}`}] } :
        { type: 'optional', nodes: [...state['optional']['nodes'], { type: 'text', value: text }] }
      rest: rest;
    } :
    {
      ast: state['ast'] extends [...infer nodes extends Array<Node>, { type: 'text', value: infer value extends string }] ?
        [...nodes, { type: 'text', value: `${value}${text}`}] :
        [...state['ast'], { type: 'text', value: text }]
      optional: state['optional']
      rest: rest;
    }

// Identifier --------------------------------------------------------------------------------------

// prettier-ignore
type _a_z = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
type _A_Z = Uppercase<_a_z>;
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

type IdentifierHead = _a_z | _A_Z | '_' | '$';
type IdentifierTail = IdentifierHead | _0_9;

type IdentiferParse<text extends string> = _IdentifierParse<{ identifier: ''; rest: text }>;

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
