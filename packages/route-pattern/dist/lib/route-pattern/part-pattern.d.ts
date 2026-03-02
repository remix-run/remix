import type { Span } from './split.ts';
import { type HrefParams } from './href.ts';
import type { RoutePattern } from '../route-pattern.ts';
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
    name: string;
};
export declare class PartPattern {
    #private;
    readonly tokens: Array<PartPatternToken>;
    readonly optionals: Map<number, number>;
    readonly type: 'hostname' | 'pathname';
    constructor(args: {
        tokens: Array<PartPatternToken>;
        optionals: Map<number, number>;
    }, options: {
        type: 'hostname' | 'pathname';
    });
    get params(): Array<Extract<PartPatternToken, {
        type: ':' | '*';
    }>>;
    get separator(): '.' | '/';
    static parse(source: string, options: {
        span?: Span;
        type: 'hostname' | 'pathname';
    }): PartPattern;
    get source(): string;
    /**
     * Generate a partial href from a part pattern and params.
     *
     * @param pattern The route pattern containing the part pattern.
     * @param params The parameters to substitute into the pattern.
     * @returns The partial href for the given params
     */
    href(pattern: RoutePattern, params: HrefParams): string;
    match(part: string, options?: {
        ignoreCase?: boolean;
    }): PartPatternMatch | null;
}
export {};
//# sourceMappingURL=part-pattern.d.ts.map