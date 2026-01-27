import type { Parse, Token, Optional, ParsedPattern } from './parse.ts';
import type { Simplify } from './type-utils.ts';
/**
 * The parameters that are parsed when a pattern matches a URL.
 */
export type Params<T extends string> = T extends string ? BuildParams<T> : never;
type BuildParams<T extends string> = Parse<T> extends infer A extends ParsedPattern ? Simplify<ParamsFromTokens<A['protocol']> & ParamsFromTokens<A['hostname']> & ParamsFromTokens<A['pathname']>> : never;
type ParamsFromTokens<T extends Token[] | undefined, IsOptional extends boolean = false> = T extends [infer Head extends Token, ...infer Tail extends Token[]] ? Head extends Optional ? ParamsFromTokens<Head['tokens'], true> & ParamsFromTokens<Tail, IsOptional> : Head extends {
    type: 'variable' | 'wildcard';
    name: infer N extends string;
} ? IsOptional extends true ? {
    [K in N]: string | undefined;
} & ParamsFromTokens<Tail, IsOptional> : {
    [K in N]: string;
} & ParamsFromTokens<Tail, IsOptional> : Head extends {
    type: 'wildcard';
} ? IsOptional extends true ? {
    '*': string | undefined;
} & ParamsFromTokens<Tail, IsOptional> : {
    '*': string;
} & ParamsFromTokens<Tail, IsOptional> : ParamsFromTokens<Tail, IsOptional> : {};
export type RequiredParams<T extends string> = Parse<T> extends infer A extends ParsedPattern ? RequiredPartParams<A['protocol']> | RequiredPartParams<A['hostname']> | RequiredPartParams<A['pathname']> : never;
type RequiredPartParams<T extends Token[] | undefined> = T extends [infer Head extends Token, ...infer Tail extends Token[]] ? Head extends Optional ? RequiredPartParams<Tail> : Head extends {
    type: 'variable' | 'wildcard';
    name: infer N extends string;
} ? N | RequiredPartParams<Tail> : Head extends {
    type: 'wildcard';
} ? '*' | RequiredPartParams<Tail> : RequiredPartParams<Tail> : never;
export type OptionalParams<T extends string> = Parse<T> extends infer A extends ParsedPattern ? OptionalPartParams<A['protocol']> | OptionalPartParams<A['hostname']> | OptionalPartParams<A['pathname']> : never;
type OptionalPartParams<T extends Token[] | undefined, IsOptional extends boolean = false> = T extends [infer Head extends Token, ...infer Tail extends Token[]] ? Head extends Optional ? OptionalPartParams<Head['tokens'], true> | OptionalPartParams<Tail, IsOptional> : Head extends {
    type: 'variable' | 'wildcard';
    name: infer N extends string;
} ? IsOptional extends true ? N | OptionalPartParams<Tail, IsOptional> : OptionalPartParams<Tail, IsOptional> : Head extends {
    type: 'wildcard';
} ? IsOptional extends true ? '*' | OptionalPartParams<Tail, IsOptional> : OptionalPartParams<Tail, IsOptional> : OptionalPartParams<Tail, IsOptional> : never;
export {};
//# sourceMappingURL=params.d.ts.map