import type { PartPattern, PartPatternToken } from '../route-pattern.ts';
import type { MatchParamMeta } from './types.ts';
import { type MatchWorkBudget } from './limits.ts';
type Unit = {
    readonly value: string;
    readonly structural: boolean;
    readonly begin: number;
    readonly end: number;
};
export type CanonicalText = {
    readonly units: ReadonlyArray<Unit>;
    readonly length: number;
};
type CompiledToken = {
    readonly type: 'text';
    readonly unit: Unit;
} | {
    readonly type: 'separator';
    readonly unit: Unit;
} | Extract<PartPatternToken, {
    type: ':' | '*' | '(' | ')';
}>;
export type PartProgram = {
    readonly type: PartPattern['type'];
    readonly tokens: ReadonlyArray<CompiledToken>;
    readonly optionals: ReadonlyMap<number, number>;
    readonly captureNames: ReadonlySet<string>;
    readonly matchKind: 'static' | 'linear' | 'state';
    readonly staticPrefix: ReadonlyArray<Unit>;
    readonly staticSuffix: ReadonlyArray<Unit>;
    readonly staticAnchor: ReadonlyArray<Unit>;
};
export declare function compilePart(part: PartPattern, options?: {
    ignoreCase?: boolean;
}): PartProgram;
export declare function hasStaticSuffix(program: PartProgram, input: CanonicalText, budget: MatchWorkBudget): boolean;
export declare function hasStaticPrefix(program: PartProgram, input: CanonicalText, budget: MatchWorkBudget): boolean;
export declare function hasStaticAnchor(program: PartProgram, input: CanonicalText, budget: MatchWorkBudget): boolean;
export declare function canonicalizeUrlPart(text: string, type: PartPattern['type'], options: {
    budget: MatchWorkBudget;
    ignoreCase?: boolean;
}): CanonicalText | null;
export declare function matchPart(program: PartProgram, input: CanonicalText, budget: MatchWorkBudget): ReadonlyArray<MatchParamMeta> | null;
export declare function unitKey(unit: Pick<Unit, 'value' | 'structural'>): string;
export {};
//# sourceMappingURL=program.d.ts.map