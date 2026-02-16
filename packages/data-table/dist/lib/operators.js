import { isColumnReference, normalizeColumnInput } from "./references.js";
export function eq(column, value) {
    return createComparisonPredicate('eq', column, value);
}
export function ne(column, value) {
    return createComparisonPredicate('ne', column, value);
}
export function gt(column, value) {
    return createComparisonPredicate('gt', column, value);
}
export function gte(column, value) {
    return createComparisonPredicate('gte', column, value);
}
export function lt(column, value) {
    return createComparisonPredicate('lt', column, value);
}
export function lte(column, value) {
    return createComparisonPredicate('lte', column, value);
}
/**
 * Builds an `IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns An `in` comparison predicate.
 */
export function inList(column, values) {
    return {
        type: 'comparison',
        operator: 'in',
        column: resolvePredicateColumn(column),
        value: [...values],
        valueType: 'value',
    };
}
/**
 * Builds a `NOT IN` predicate.
 * @param column Column to compare.
 * @param values Candidate values.
 * @returns A `notIn` comparison predicate.
 */
export function notInList(column, values) {
    return {
        type: 'comparison',
        operator: 'notIn',
        column: resolvePredicateColumn(column),
        value: [...values],
        valueType: 'value',
    };
}
/**
 * Builds a case-sensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns A `like` comparison predicate.
 */
export function like(column, value) {
    return {
        type: 'comparison',
        operator: 'like',
        column: resolvePredicateColumn(column),
        value,
        valueType: 'value',
    };
}
/**
 * Builds a case-insensitive SQL `LIKE` predicate.
 * @param column Column to compare.
 * @param value Match pattern.
 * @returns An `ilike` comparison predicate.
 */
export function ilike(column, value) {
    return {
        type: 'comparison',
        operator: 'ilike',
        column: resolvePredicateColumn(column),
        value,
        valueType: 'value',
    };
}
/**
 * Builds a `BETWEEN` predicate.
 * @param column Column to compare.
 * @param lower Lower bound value.
 * @param upper Upper bound value.
 * @returns A `between` predicate.
 */
export function between(column, lower, upper) {
    return {
        type: 'between',
        column: resolvePredicateColumn(column),
        lower,
        upper,
    };
}
/**
 * Builds an `IS NULL` predicate.
 * @param column Column to compare.
 * @returns An `isNull` predicate.
 */
export function isNull(column) {
    return { type: 'null', operator: 'isNull', column: resolvePredicateColumn(column) };
}
/**
 * Builds an `IS NOT NULL` predicate.
 * @param column Column to compare.
 * @returns A `notNull` predicate.
 */
export function notNull(column) {
    return { type: 'null', operator: 'notNull', column: resolvePredicateColumn(column) };
}
/**
 * Combines predicates with logical `AND`.
 * @param predicates Child predicates.
 * @returns A logical `and` predicate.
 */
export function and(...predicates) {
    let filtered = predicates.filter(Boolean);
    return { type: 'logical', operator: 'and', predicates: filtered };
}
/**
 * Combines predicates with logical `OR`.
 * @param predicates Child predicates.
 * @returns A logical `or` predicate.
 */
export function or(...predicates) {
    let filtered = predicates.filter(Boolean);
    return { type: 'logical', operator: 'or', predicates: filtered };
}
/**
 * Returns `true` when a value is a normalized predicate object.
 * @param value Value to inspect.
 * @returns Whether the value is a predicate.
 */
export function isPredicate(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    if (!('type' in value)) {
        return false;
    }
    let input = value;
    return (input.type === 'comparison' ||
        input.type === 'between' ||
        input.type === 'null' ||
        input.type === 'logical');
}
/**
 * Normalizes object shorthand into a predicate tree.
 * @param input Predicate object or shorthand where map.
 * @returns A normalized predicate.
 */
export function normalizeWhereInput(input) {
    if (isPredicate(input)) {
        return input;
    }
    let keys = Object.keys(input);
    let predicates = keys.map((column) => eq(column, input[column]));
    return and(...predicates);
}
/**
 * Collects referenced columns from a predicate tree.
 * @param predicate Predicate to inspect.
 * @returns Referenced column names.
 */
export function getPredicateColumns(predicate) {
    if (predicate.type === 'comparison') {
        if (predicate.valueType === 'column') {
            return [predicate.column, predicate.value];
        }
        return [predicate.column];
    }
    if (predicate.type === 'between') {
        return [predicate.column];
    }
    if (predicate.type === 'null') {
        return [predicate.column];
    }
    let columns = [];
    for (let child of predicate.predicates) {
        columns.push(...getPredicateColumns(child));
    }
    return columns;
}
function isQualifiedColumnReference(value) {
    if (typeof value !== 'string') {
        return false;
    }
    return /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}
function resolvePredicateColumn(column) {
    return normalizeColumnInput(column);
}
function resolveComparisonValue(value) {
    if (isColumnReference(value)) {
        return normalizeColumnInput(value);
    }
    return value;
}
function createComparisonPredicate(operator, column, value) {
    let normalizedColumn = resolvePredicateColumn(column);
    let normalizedValue = resolveComparisonValue(value);
    if (isQualifiedColumnReference(normalizedColumn) && isQualifiedColumnReference(normalizedValue)) {
        return {
            type: 'comparison',
            operator,
            column: normalizedColumn,
            value: normalizedValue,
            valueType: 'column',
        };
    }
    return {
        type: 'comparison',
        operator,
        column: normalizedColumn,
        value: normalizedValue,
        valueType: 'value',
    };
}
