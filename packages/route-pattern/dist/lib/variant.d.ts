import type { PartPattern, PartPatternToken } from './route-pattern/part-pattern.ts';
type Token = Extract<PartPatternToken, {
    type: 'text' | ':' | '*' | 'separator';
}>;
export declare class Variant {
    #private;
    /** Params use `nameIndex` to reference params in the PartPattern's `paramNames` */
    tokens: Array<Token>;
    constructor(partPattern: PartPattern, tokens: Array<Token>);
    get requiredParams(): Array<string>;
    static generate(pattern: PartPattern): Array<Variant>;
    toString(): string;
}
export {};
//# sourceMappingURL=variant.d.ts.map