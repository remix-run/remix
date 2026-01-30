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
    name: string;
};
export declare class PartPattern {
    #private;
    readonly tokens: Array<PartPatternToken>;
    readonly optionals: Map<number, number>;
    readonly type: 'hostname' | 'pathname';
    readonly ignoreCase: boolean;
    constructor(args: {
        tokens: Array<PartPatternToken>;
        optionals: Map<number, number>;
    }, options: {
        type: 'hostname' | 'pathname';
        ignoreCase: boolean;
    });
    get params(): Array<Extract<PartPatternToken, {
        type: ':' | '*';
    }>>;
    get separator(): '.' | '/';
    static parse(source: string, options: {
        span?: Span;
        type: 'hostname' | 'pathname';
        ignoreCase: boolean;
    }): PartPattern;
    get source(): string;
    toString(): string;
    match(part: string): PartPatternMatch | null;
}
export {};
//# sourceMappingURL=part-pattern.d.ts.map