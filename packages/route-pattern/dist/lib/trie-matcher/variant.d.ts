import type { PartPattern, PartPatternToken } from '../route-pattern/part-pattern.ts';
import type { RoutePattern } from '../route-pattern.ts';
type Variant = {
    protocol: 'http' | 'https';
    hostname: {
        type: 'static';
        value: string;
    } | {
        type: 'dynamic';
        value: PartPattern;
    } | {
        type: 'any';
    };
    port: string;
    pathname: PartPatternVariant;
};
type Segment = {
    type: 'static';
    key: string;
} | {
    type: 'variable';
    key: string;
    regexp: RegExp;
} | {
    type: 'wildcard';
    key: string;
    regexp: RegExp;
};
export declare function generate(pattern: RoutePattern): Array<Variant>;
type Token = Extract<PartPatternToken, {
    type: 'text' | ':' | '*' | 'separator';
}>;
type Param = Extract<PartPatternToken, {
    type: ':' | '*';
}>;
export declare class PartPatternVariant {
    tokens: Array<Token>;
    constructor(tokens: Array<Token>);
    static generate(pattern: PartPattern): Array<PartPatternVariant>;
    params(): Array<Param>;
    toString(separator: string): string;
    segments(options?: {
        ignoreCase?: boolean;
    }): Array<Segment>;
}
export {};
//# sourceMappingURL=variant.d.ts.map