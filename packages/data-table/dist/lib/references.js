/**
 * Symbol key used to store non-enumerable table metadata.
 */
export const tableMetadataKey = Symbol('data-table.tableMetadata');
/**
 * Symbol key used to store non-enumerable column metadata.
 */
export const columnMetadataKey = Symbol('data-table.columnMetadata');
/**
 * Returns `true` when a value is a `data-table` column reference.
 * @param value Value to inspect.
 * @returns Whether the value is a column reference object.
 */
export function isColumnReference(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    if (!('kind' in value) || value.kind !== 'column') {
        return false;
    }
    return columnMetadataKey in value;
}
/**
 * Normalizes string/column-reference inputs to a qualified column name.
 * @param input Column name or column reference.
 * @returns The normalized qualified column name.
 */
export function normalizeColumnInput(input) {
    if (typeof input === 'string') {
        return input;
    }
    return input[columnMetadataKey].qualifiedName;
}
