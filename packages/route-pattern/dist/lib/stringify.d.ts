import type { Token, ParseResult, ParsedPattern } from './parse.ts';
import type { SearchConstraints } from './search-constraints.ts';
export declare function stringify(parsed: Partial<ParseResult>): string;
export declare function startsWithSeparator(tokens: Token[]): boolean;
export declare function stringifyTokens(tokens: Token[], sep?: string): string;
export declare function stringifySearchConstraints(search: SearchConstraints): string;
export type Stringify<T extends ParsedPattern> = T['hostname'] extends Token[] ? `${StringifyTokens<T['protocol'], ''>}://${StringifyTokens<T['hostname'], '.'>}${StringifyPort<T['port']>}${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}` : `${StringifyPathname<T['pathname']>}${StringifySearch<T['search']>}`;
type StringifyTokens<T extends Token[] | undefined, Sep extends string> = T extends undefined ? '' : T extends [] ? '' : T extends [infer Head extends Token, ...infer Tail extends Token[]] ? `${StringifyToken<Head, Sep>}${StringifyTokens<Tail, Sep>}` : never;
type StringifyToken<T extends Token, Sep extends string> = T extends {
    type: 'text';
    value: infer V extends string;
} ? V : T extends {
    type: 'variable';
    name: infer N extends string;
} ? `:${N}` : T extends {
    type: 'wildcard';
    name: infer N extends string;
} ? `*${N}` : T extends {
    type: 'wildcard';
} ? '*' : T extends {
    type: 'separator';
} ? Sep : T extends {
    type: 'optional';
    tokens: infer Tokens extends Token[];
} ? `(${StringifyTokens<Tokens, Sep>})` : never;
type StringifyPathname<T extends Token[] | undefined> = T extends undefined ? '/' : T extends [] ? '/' : T extends Token[] ? StartsWithSeparator<T> extends true ? `${StringifyTokens<T, '/'>}` : `/${StringifyTokens<T, '/'>}` : never;
type StringifyPort<T extends string | undefined> = T extends string ? `:${T}` : '';
type StringifySearch<T extends string | undefined> = T extends string ? `?${T}` : '';
export type StartsWithSeparator<T extends Token[]> = T extends [] ? false : T extends [{
    type: 'separator';
}, ...Token[]] ? true : T extends [{
    type: 'optional';
    tokens: infer Tokens extends Token[];
}, ...Token[]] ? StartsWithSeparator<Tokens> : false;
export {};
//# sourceMappingURL=stringify.d.ts.map