import type { ColumnInput, ColumnReferenceLike, NormalizeColumnInput } from './references.ts';
/**
 * Comparison operators supported by `comparison` predicates.
 */
export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'like' | 'ilike';
type QualifiedColumnReference = `${string}.${string}`;
type PredicateColumn<input extends string | ColumnReferenceLike> = NormalizeColumnInput<input> & string;
/**
 * Normalized predicate representation consumed by adapters.
 */
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
/**
 * User-facing where input accepted by `query.where()` and relation modifiers.
 */
export type WhereInput<column extends string = string> = Predicate<column> | WhereObject<column>;
/**
 * Builds an equality predicate.
 */
export declare function eq<left extends ColumnInput<QualifiedColumnReference>, right extends ColumnInput<QualifiedColumnReference>>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<PredicateColumn<left> | PredicateColumn<right>>;
export declare function eq<column extends string | ColumnReferenceLike>(column: column, value: unknown): Predicate<PredicateColumn<column>>;
/**
 * Builds an inequality predicate.
 */
export declare function ne<left extends ColumnInput<QualifiedColumnReference>, right extends ColumnInput<QualifiedColumnReference>>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<PredicateColumn<left> | PredicateColumn<right>>;
export declare function ne<column extends string | ColumnReferenceLike>(column: column, value: unknown): Predicate<PredicateColumn<column>>;
/**
 * Builds a greater-than predicate.
 */
export declare function gt<left extends ColumnInput<QualifiedColumnReference>, right extends ColumnInput<QualifiedColumnReference>>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<PredicateColumn<left> | PredicateColumn<right>>;
export declare function gt<column extends string | ColumnReferenceLike>(column: column, value: unknown): Predicate<PredicateColumn<column>>;
/**
 * Builds a greater-than-or-equal predicate.
 */
export declare function gte<left extends ColumnInput<QualifiedColumnReference>, right extends ColumnInput<QualifiedColumnReference>>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<PredicateColumn<left> | PredicateColumn<right>>;
export declare function gte<column extends string | ColumnReferenceLike>(column: column, value: unknown): Predicate<PredicateColumn<column>>;
/**
 * Builds a less-than predicate.
 */
export declare function lt<left extends ColumnInput<QualifiedColumnReference>, right extends ColumnInput<QualifiedColumnReference>>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<PredicateColumn<left> | PredicateColumn<right>>;
export declare function lt<column extends string | ColumnReferenceLike>(column: column, value: unknown): Predicate<PredicateColumn<column>>;
/**
 * Builds a less-than-or-equal predicate.
 */
export declare function lte<left extends ColumnInput<QualifiedColumnReference>, right extends ColumnInput<QualifiedColumnReference>>(column: left, value: right & (right extends `${string}@${string}` ? never : right)): Predicate<PredicateColumn<left> | PredicateColumn<right>>;
export declare function lte<column extends string | ColumnReferenceLike>(column: column, value: unknown): Predicate<PredicateColumn<column>>;
/**
 * Builds an `IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns An `in` comparison predicate.
 */
export declare function inList<column extends string | ColumnReferenceLike>(column: column, values: readonly unknown[]): Predicate<PredicateColumn<column>>;
/**
 * Builds a `NOT IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns A `notIn` comparison predicate.
 */
export declare function notInList<column extends string | ColumnReferenceLike>(column: column, values: readonly unknown[]): Predicate<PredicateColumn<column>>;
/**
 * Builds a case-sensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns A `like` comparison predicate.
 */
export declare function like<column extends string | ColumnReferenceLike>(column: column, value: string): Predicate<PredicateColumn<column>>;
/**
 * Builds a case-insensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns An `ilike` comparison predicate.
 */
export declare function ilike<column extends string | ColumnReferenceLike>(column: column, value: string): Predicate<PredicateColumn<column>>;
/**
 * Builds a `BETWEEN` predicate.
 * @param column Column to compare.
 * @param lower Lower bound value.
 * @param upper Upper bound value.
 * @returns A `between` predicate.
 */
export declare function between<column extends string | ColumnReferenceLike>(column: column, lower: unknown, upper: unknown): Predicate<PredicateColumn<column>>;
/**
 * Builds an `IS NULL` predicate.
 * @param column Column to compare.
 * @returns An `isNull` predicate.
 */
export declare function isNull<column extends string | ColumnReferenceLike>(column: column): Predicate<PredicateColumn<column>>;
/**
 * Builds an `IS NOT NULL` predicate.
 * @param column Column to compare.
 * @returns A `notNull` predicate.
 */
export declare function notNull<column extends string | ColumnReferenceLike>(column: column): Predicate<PredicateColumn<column>>;
/**
 * Combines predicates with logical `AND`.
 * @param predicates Child predicates.
 * @returns A logical `and` predicate.
 */
export declare function and<column extends string>(...predicates: Predicate<column>[]): Predicate<column>;
/**
 * Combines predicates with logical `OR`.
 * @param predicates Child predicates.
 * @returns A logical `or` predicate.
 */
export declare function or<column extends string>(...predicates: Predicate<column>[]): Predicate<column>;
/**
 * Returns `true` when a value is a normalized predicate object.
 * @param value Value to inspect.
 * @returns Whether the value is a predicate.
 */
export declare function isPredicate<column extends string = string>(value: unknown): value is Predicate<column>;
/**
 * Normalizes object shorthand into a predicate tree.
 * @param input Predicate object or shorthand where map.
 * @returns A normalized predicate.
 */
export declare function normalizeWhereInput<column extends string>(input: WhereInput<column>): Predicate<column>;
/**
 * Collects referenced columns from a predicate tree.
 * @param predicate Predicate to inspect.
 * @returns Referenced column names.
 */
export declare function getPredicateColumns(predicate: Predicate): string[];
export {};
//# sourceMappingURL=operators.d.ts.map