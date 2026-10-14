import type { Parse, Token } from './parse.ts'

// oxfmt-ignore
export type ParseParams<source extends string> =
  string extends source ? Record<string, string | undefined> :
  Parse<source> extends infer pattern ?
    pattern extends never ? never :
    pattern extends { hostname: infer hostname, pathname: infer pathname } ?
      & (hostname extends Token[] ? ParsePartParams<hostname> : {})
      & (pathname extends Token[] ? ParsePartParams<pathname> : {}) :
    never :
  never

// oxfmt-ignore
type ParsePartParams<tokens extends Token[], optional extends boolean = false> =
  Token[] extends tokens ? Record<string, string | undefined> :
  tokens extends [infer token extends Token, ...infer rest extends Token[]] ?
    token extends { type: 'variable' | 'wildcard', name: infer name extends string } ?
      Param<name, optional> & ParsePartParams<rest, optional> :
    token extends { type: 'wildcard' } ?
      Param<'*', optional> & ParsePartParams<rest, optional> :
    token extends { type: 'optional', tokens: infer optionalTokens extends Token[] } ?
      ParsePartParams<optionalTokens, true> & ParsePartParams<rest, optional> :
    ParsePartParams<rest, optional> :
  {}

type Param<name extends string, optional extends boolean> = optional extends false
  ? { [key in name]: string }
  : { [key in name]: string | undefined }
