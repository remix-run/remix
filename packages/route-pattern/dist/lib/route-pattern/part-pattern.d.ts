import { Variant } from '../variant.ts';
import type { Span } from './split.ts';
type MatchParam = {
    type: ':' | '*';
    name: string;
    value: string;
    begin: number;
    end: number;
};
export type PartPatternMatch = Array<MatchParam>;
export type PartPatternToken = {
    type: 'text';
    text: string;
} | {
    type: 'separator';
} | {
    type: '(' | ')';
} | {
    type: ':' | '*';
    nameIndex: number;
};
type AST = {
    tokens: Array<PartPatternToken>;
    paramNames: Array<string>;
    optionals: Map<number, number>;
};
export declare class PartPattern {
    #private;
    readonly tokens: AST['tokens'];
    readonly paramNames: AST['paramNames'];
    readonly optionals: AST['optionals'];
    readonly type: 'hostname' | 'pathname';
    readonly ignoreCase: boolean;
    constructor(ast: AST, options: {
        type: 'hostname' | 'pathname';
        ignoreCase: boolean;
    });
    get separator(): '.' | '/';
    static parse(source: string, options: {
        span?: Span;
        type: 'hostname' | 'pathname';
        ignoreCase: boolean;
    }): PartPattern;
    get variants(): Array<Variant>;
    get source(): string;
    toString(): string;
    /**
     * @param params The parameters to substitute into the pattern.
     * @returns The href (URL) for the given params, or null if no variant matches.
     */
    href(params: Record<string, string | number>): string | null;
    match(part: string): PartPatternMatch | null;
}
export {};
//# sourceMappingURL=part-pattern.d.ts.map