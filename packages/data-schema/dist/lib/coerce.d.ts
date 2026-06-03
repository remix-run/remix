import type { Schema } from './schema.ts';
/**
 * Coerce input into a number.
 *
 * Accepts:
 * - finite `number` values (excluding `NaN` and `Infinity`)
 * - strings parsed with `Number(...)` after trimming (must produce finite result)
 *
 * @returns A schema that produces a `number`
 */
export declare function coerceNumber(): Schema<unknown, number>;
/**
 * Coerce input into a boolean.
 *
 * Accepts:
 * - `boolean` values as-is
 * - strings `"true"` and `"false"` (case-insensitive, trimmed)
 *
 * @returns A schema that produces a `boolean`
 */
export declare function coerceBoolean(): Schema<unknown, boolean>;
/**
 * Coerce input into a `Date`.
 *
 * Accepts:
 * - valid `Date` instances
 * - date strings supported by `new Date(value)`
 *
 * @returns A schema that produces a `Date`
 */
export declare function coerceDate(): Schema<unknown, Date>;
/**
 * Coerce input into a `bigint`.
 *
 * Accepts:
 * - `bigint` values as-is
 * - integer `number` values
 * - integer strings parsed via `BigInt(...)`
 *
 * @returns A schema that produces a `bigint`
 */
export declare function coerceBigint(): Schema<unknown, bigint>;
/**
 * Coerce input into a string.
 *
 * Accepts:
 * - `string` values as-is
 * - primitive values that can be stringified (`number`, `boolean`, `bigint`, `symbol`)
 *
 * @returns A schema that produces a `string`
 */
export declare function coerceString(): Schema<unknown, string>;
//# sourceMappingURL=coerce.d.ts.map