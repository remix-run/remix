import type { PartPattern, PartPatternToken } from './route-pattern/part-pattern.ts';
type Token = Extract<PartPatternToken, {
    type: 'text' | ':' | '*' | 'separator';
}>;
type Param = Extract<PartPatternToken, {
    type: ':' | '*';
}>;
export declare class Variant {
    #private;
    tokens: Array<Token>;
    constructor(partPattern: PartPattern, tokens: Array<Token>);
    get params(): Array<Param>;
    static generate(pattern: PartPattern): Array<Variant>;
    toString(): string;
}
export {};
//# sourceMappingURL=variant.d.ts.map