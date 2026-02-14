export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'like' | 'ilike';
type QualifiedColumnReference = `${string}.${string}`;
export type Predicate<column extends string = string> = {
    type: 'comparison';
    operator: ComparisonOperator;
    column: column;
    value: unknown;
    valueType: 'value';
} | {
    type: 'comparison';
    operator: Exclude<ComparisonOperator, 'in' | 'notIn'>;
    column: column;
    value: column;
    valueType: 'column';
} | {
    type: 'between';
    column: column;
    lower: unknown;
    upper: unknown;
} | {
    type: 'null';
    operator: 'isNull' | 'notNull';
    column: column;
} | {
    type: 'logical';
    operator: 'and' | 'or';
    predicates: Predicate<column>[];
};
export type WhereObject<column extends string = string> = Partial<Record<column, unknown>>;
export type WhereInput<column extends string = string> = Predicate<column> | WhereObject<column>;
export declare function eq<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<left | right>;
export declare function eq<column extends string>(column: column, value: unknown): Predicate<column>;
export declare function ne<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<left | right>;
export declare function ne<column extends string>(column: column, value: unknown): Predicate<column>;
export declare function gt<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<left | right>;
export declare function gt<column extends string>(column: column, value: unknown): Predicate<column>;
export declare function gte<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<left | right>;
export declare function gte<column extends string>(column: column, value: unknown): Predicate<column>;
export declare function lt<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<left | right>;
export declare function lt<column extends string>(column: column, value: unknown): Predicate<column>;
export declare function lte<left extends QualifiedColumnReference, right extends QualifiedColumnReference>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<left | right>;
export declare function lte<column extends string>(column: column, value: unknown): Predicate<column>;
export declare function inList<column extends string>(column: column, values: readonly unknown[]): Predicate<column>;
export declare function notInList<column extends string>(column: column, values: readonly unknown[]): Predicate<column>;
export declare function like<column extends string>(column: column, value: string): Predicate<column>;
export declare function ilike<column extends string>(column: column, value: string): Predicate<column>;
export declare function between<column extends string>(column: column, lower: unknown, upper: unknown): Predicate<column>;
export declare function isNull<column extends string>(column: column): Predicate<column>;
export declare function notNull<column extends string>(column: column): Predicate<column>;
export declare function and<column extends string>(...predicates: Predicate<column>[]): Predicate<column>;
export declare function or<column extends string>(...predicates: Predicate<column>[]): Predicate<column>;
export declare function isPredicate<column extends string = string>(value: unknown): value is Predicate<column>;
export declare function normalizeWhereInput<column extends string>(input: WhereInput<column>): Predicate<column>;
export declare function getPredicateColumns(predicate: Predicate): string[];
export {};
//# sourceMappingURL=operators.d.ts.map