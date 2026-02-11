export function eq(column, value) {
    if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
        return {
            type: 'comparison',
            operator: 'eq',
            column,
            value,
            valueType: 'column',
        };
    }
    return { type: 'comparison', operator: 'eq', column, value, valueType: 'value' };
}
export function ne(column, value) {
    if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
        return {
            type: 'comparison',
            operator: 'ne',
            column,
            value,
            valueType: 'column',
        };
    }
    return { type: 'comparison', operator: 'ne', column, value, valueType: 'value' };
}
export function gt(column, value) {
    if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
        return {
            type: 'comparison',
            operator: 'gt',
            column,
            value,
            valueType: 'column',
        };
    }
    return { type: 'comparison', operator: 'gt', column, value, valueType: 'value' };
}
export function gte(column, value) {
    if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
        return {
            type: 'comparison',
            operator: 'gte',
            column,
            value,
            valueType: 'column',
        };
    }
    return { type: 'comparison', operator: 'gte', column, value, valueType: 'value' };
}
export function lt(column, value) {
    if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
        return {
            type: 'comparison',
            operator: 'lt',
            column,
            value,
            valueType: 'column',
        };
    }
    return { type: 'comparison', operator: 'lt', column, value, valueType: 'value' };
}
export function lte(column, value) {
    if (isQualifiedColumnReference(column) && isQualifiedColumnReference(value)) {
        return {
            type: 'comparison',
            operator: 'lte',
            column,
            value,
            valueType: 'column',
        };
    }
    return { type: 'comparison', operator: 'lte', column, value, valueType: 'value' };
}
export function inList(column, values) {
    return { type: 'comparison', operator: 'in', column, value: [...values], valueType: 'value' };
}
export function notInList(column, values) {
    return {
        type: 'comparison',
        operator: 'notIn',
        column,
        value: [...values],
        valueType: 'value',
    };
}
export function like(column, value) {
    return { type: 'comparison', operator: 'like', column, value, valueType: 'value' };
}
export function ilike(column, value) {
    return { type: 'comparison', operator: 'ilike', column, value, valueType: 'value' };
}
export function between(column, lower, upper) {
    return { type: 'between', column, lower, upper };
}
export function isNull(column) {
    return { type: 'null', operator: 'isNull', column };
}
export function notNull(column) {
    return { type: 'null', operator: 'notNull', column };
}
export function and(...predicates) {
    let filtered = predicates.filter(Boolean);
    return { type: 'logical', operator: 'and', predicates: filtered };
}
export function or(...predicates) {
    let filtered = predicates.filter(Boolean);
    return { type: 'logical', operator: 'or', predicates: filtered };
}
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
export function normalizeWhereInput(input) {
    if (isPredicate(input)) {
        return input;
    }
    let keys = Object.keys(input);
    let predicates = keys.map((column) => eq(column, input[column]));
    return and(...predicates);
}
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
