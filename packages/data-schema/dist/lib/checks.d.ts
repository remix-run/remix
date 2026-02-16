import type { Check } from './schema.ts';
/**
 * Require a string to be at least `length` characters long.
 *
 * @param length The minimum number of characters
 * @returns A `Check` that enforces the minimum length
 */
export declare function minLength(length: number): Check<string>;
/**
 * Require a string to be at most `length` characters long.
 *
 * @param length The maximum number of characters
 * @returns A `Check` that enforces the maximum length
 */
export declare function maxLength(length: number): Check<string>;
/**
 * Require a string to be a valid email address.
 *
 * @returns A `Check` that validates email-like strings
 */
export declare function email(): Check<string>;
/**
 * Require a string to be a valid URL.
 *
 * @returns A `Check` that validates URL-like strings
 */
export declare function url(): Check<string>;
/**
 * Require a number to be greater than or equal to `limit`.
 *
 * @param limit The inclusive minimum value
 * @returns A `Check` that enforces the lower bound
 */
export declare function min(limit: number): Check<number>;
/**
 * Require a number to be less than or equal to `limit`.
 *
 * @param limit The inclusive maximum value
 * @returns A `Check` that enforces the upper bound
 */
export declare function max(limit: number): Check<number>;
//# sourceMappingURL=checks.d.ts.map