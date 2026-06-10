import type { PartPattern, PartPatternToken, RoutePattern } from '../route-pattern.ts';
export type Variant = {
    readonly protocol: ProtocolVariant;
    readonly hostname: HostnameVariant;
    readonly port: string;
    readonly pathname: PathnameVariant;
};
export declare function generateVariants(pattern: RoutePattern): ReadonlyArray<Variant>;
type ProtocolVariant = 'http' | 'https';
export type Param = Extract<PartPatternToken, {
    type: ':' | '*';
}>;
type HostnameVariant = {
    readonly type: 'static';
    readonly value: string;
} | {
    readonly type: 'dynamic';
    readonly params: ReadonlyArray<Param>;
    readonly regexp: RegExp;
} | {
    readonly type: 'any';
};
export type PathnameVariantSegment = {
    readonly type: 'static';
    readonly key: string;
} | {
    readonly type: 'variable';
    readonly key: string;
    readonly regexp: RegExp;
    readonly params: ReadonlyArray<Param>;
} | {
    readonly type: 'wildcard';
    readonly key: string;
    readonly regexp: RegExp;
    readonly params: ReadonlyArray<Param>;
};
export type PathnameVariant = ReadonlyArray<PathnameVariantSegment>;
type PartVariantToken = Exclude<PartPatternToken, {
    type: '(' | ')';
}>;
type PartVariant = ReadonlyArray<PartVariantToken>;
/**
 * Expand a part pattern's optionals into the list of all concrete variants.
 *
 * Each variant is the linear token sequence you'd get by independently choosing
 * to include or omit every `(` `)` group. No nesting, no optional markers.
 *
 * @private
 */
export declare function generatePartVariants(part: PartPattern): ReadonlyArray<PartVariant>;
export {};
//# sourceMappingURL=variant.d.ts.map