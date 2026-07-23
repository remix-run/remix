/**
 * Normalizes an arbitrary join type string into `inner`, `left`, or `right`.
 * @param type Input join type.
 * @returns Normalized join type.
 */
export function normalizeJoinType(type) {
    if (type === 'left') {
        return 'left';
    }
    if (type === 'right') {
        return 'right';
    }
    return 'inner';
}
/**
 * Returns stable column order from the union of keys in the provided rows.
 * @param rows Row objects to scan for keys.
 * @returns Deduplicated key list in encounter order.
 */
export function collectColumns(rows) {
    let columns = [];
    let seen = new Set();
    for (let row of rows) {
        for (let key in row) {
            if (!Object.prototype.hasOwnProperty.call(row, key)) {
                continue;
            }
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            columns.push(key);
        }
    }
    return columns;
}
/**
 * Quotes each segment of a dotted identifier path.
 *
 * Wildcard segments (`*`) are preserved.
 * @param path Dotted path to quote.
 * @param quoteIdentifier Dialect-specific identifier quote function.
 * @returns Quoted path string.
 */
export function quotePath(path, quoteIdentifier) {
    if (path === '*') {
        return '*';
    }
    return path
        .split('.')
        .map((segment) => {
        if (segment === '*') {
            return '*';
        }
        return quoteIdentifier(segment);
    })
        .join('.');
}
/**
 * Quotes a `{ schema?, name }` table reference using a dialect quote function.
 * @param table Table reference to quote.
 * @param quoteIdentifier Dialect-specific identifier quote function.
 * @returns Quoted table reference.
 */
export function quoteTableRef(table, quoteIdentifier) {
    if (table.schema) {
        return quoteIdentifier(table.schema) + '.' + quoteIdentifier(table.name);
    }
    return quoteIdentifier(table.name);
}
/**
 * Converts a JavaScript value into a SQL literal string.
 * @param value Value to serialize.
 * @param options Serialization options.
 * @param options.booleansAsIntegers When `true`, booleans render as `1`/`0`.
 * @returns SQL literal text.
 */
export function quoteLiteral(value, options) {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value);
    }
    if (typeof value === 'boolean') {
        if (options?.booleansAsIntegers) {
            return value ? '1' : '0';
        }
        return value ? 'true' : 'false';
    }
    if (value instanceof Date) {
        return quoteLiteral(value.toISOString(), options);
    }
    return "'" + String(value).replace(/'/g, "''") + "'";
}
