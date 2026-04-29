import type { TableRef } from './adapter.ts';
/**
 * Function used to quote SQL identifiers for a dialect.
 */
export type QuoteIdentifier = (value: string) => string;
/**
 * Normalizes an arbitrary join type string into `inner`, `left`, or `right`.
 * @param type Input join type.
 * @returns Normalized join type.
 */
export declare function normalizeJoinType(type: string): string;
/**
 * Returns stable column order from the union of keys in the provided rows.
 * @param rows Row objects to scan for keys.
 * @returns Deduplicated key list in encounter order.
 */
export declare function collectColumns(rows: Record<string, unknown>[]): string[];
/**
 * Quotes each segment of a dotted identifier path.
 *
 * Wildcard segments (`*`) are preserved.
 * @param path Dotted path to quote.
 * @param quoteIdentifier Dialect-specific identifier quote function.
 * @returns Quoted path string.
 */
export declare function quotePath(path: string, quoteIdentifier: QuoteIdentifier): string;
/**
 * Quotes a `{ schema?, name }` table reference using a dialect quote function.
 * @param table Table reference to quote.
 * @param quoteIdentifier Dialect-specific identifier quote function.
 * @returns Quoted table reference.
 */
export declare function quoteTableRef(table: TableRef, quoteIdentifier: QuoteIdentifier): string;
/**
 * Converts a JavaScript value into a SQL literal string.
 * @param value Value to serialize.
 * @param options Serialization options.
 * @param options.booleansAsIntegers When `true`, booleans render as `1`/`0`.
 * @returns SQL literal text.
 */
export declare function quoteLiteral(value: unknown, options?: {
    booleansAsIntegers?: boolean;
}): string;
//# sourceMappingURL=sql-helpers.d.ts.map