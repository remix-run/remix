/**
 * Thrown when an assertion fails. Mirrors the shape of Node.js's built-in
 * `assert.AssertionError` so that test reporters can treat them uniformly.
 */
export declare class AssertionError extends Error {
    actual: any;
    expected: any;
    operator: string;
    /**
     * Creates a new AssertionError with the given message, actual/expected values, and operator.
     * @param options.message - The error message to display when the assertion fails.
     * @param options.actual - The actual value that was tested.
     * @param options.expected - The expected value that the actual value was compared against.
     * @param options.operator - A string describing the assertion operator (e.g. '==', '===', 'deepEqual').
     */
    constructor(options: {
        message?: string;
        actual?: any;
        expected?: any;
        operator: string;
    });
}
/**
 * Asserts that `value` is truthy. Narrows the type of `value` after the call.
 *
 * @example
 * const cookie = getSessionCookie(response)
 * assert.ok(cookie) // cookie is now `string` (not `string | null`)
 *
 * @param value - The value to test for truthiness.
 * @param message - Optional failure message.
 */
export declare function ok(value: unknown, message?: string): asserts value;
/**
 * Asserts strict equality (`===`) between `actual` and `expected`.
 *
 * @example
 * assert.equal(response.status, 200)
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value to compare against.
 * @param message - Optional failure message.
 */
export declare function equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
/**
 * Asserts strict inequality (`!==`) between `actual` and `expected`.
 *
 * @example
 * assert.notEqual(response.status, 404)
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value that `actual` must not equal.
 * @param message - Optional failure message.
 */
export declare function notEqual(actual: unknown, expected: unknown, message?: string): void;
/**
 * Asserts deep strict equality between `actual` and `expected`. Recursively
 * compares object properties using `===` at primitive leaves (no type coercion).
 *
 * @example
 * assert.deepEqual(result, { id: 1, name: 'Alice' })
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value to compare against.
 * @param message - Optional failure message.
 */
export declare function deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
/**
 * Asserts that `actual` and `expected` are **not** deeply equal.
 *
 * @example
 * assert.notDeepEqual(result, { id: 1, name: 'Alice' })
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value that `actual` must not deeply equal.
 * @param message - Optional failure message.
 */
export declare function notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
/**
 * Unconditionally fails the test with an optional message.
 *
 * @example
 * assert.fail('this branch should never be reached')
 *
 * @param message - Optional failure message.
 */
export declare function fail(message?: string): never;
/**
 * Asserts that `string` matches the given `regexp`.
 *
 * @example
 * assert.match(html, /Welcome Back/)
 *
 * @param string - The string to test.
 * @param regexp - The pattern to match against.
 * @param message - Optional failure message.
 */
export declare function match(string: string, regexp: RegExp, message?: string): void;
/**
 * Asserts that `string` does **not** match the given `regexp`.
 *
 * @example
 * assert.doesNotMatch(html, /Error/)
 *
 * @param string - The string to test.
 * @param regexp - The pattern that must not match.
 * @param message - Optional failure message.
 */
export declare function doesNotMatch(string: string, regexp: RegExp, message?: string): void;
/**
 * Asserts that `fn` throws. Optionally validates the thrown error against
 * `expectedError`, which may be an `Error` constructor, an `Error` instance
 * (matched by message), a `RegExp` (matched against the error message), or a
 * validator function that returns `true` for a valid error.
 *
 * @example
 * assert.throws(() => JSON.parse('invalid'))
 * assert.throws(() => riskyOp(), SyntaxError)
 *
 * @param fn - The function expected to throw.
 * @param expectedError - Optional error constructor, instance, RegExp, or validator.
 * @param message - Optional failure message.
 */
export declare function throws(fn: () => any, expectedError?: any, message?: string): void;
/**
 * Asserts that `fn` does **not** throw.
 *
 * @example
 * assert.doesNotThrow(() => JSON.parse('{}'))
 *
 * @param fn - The function expected not to throw.
 * @param message - Optional failure message.
 */
export declare function doesNotThrow(fn: () => any, message?: string): void;
/**
 * Asserts that the promise returned by `fn` (or the promise itself) rejects.
 * Accepts the same `expectedError` shapes as {@link throws}.
 *
 * @example
 * await assert.rejects(fetch('/missing'), (err) => err.status === 404)
 *
 * @param fn - A function returning a promise, or a promise directly.
 * @param expectedError - Optional error constructor, instance, RegExp, or validator.
 * @param message - Optional failure message.
 */
export declare function rejects(fn: (() => Promise<any>) | Promise<any>, expectedError?: any, message?: string): Promise<void>;
/**
 * Asserts that the promise returned by `fn` does **not** reject.
 *
 * @example
 * await assert.doesNotReject(() => fetch('/healthy'))
 *
 * @param fn - A function returning a promise.
 * @param message - Optional failure message.
 */
export declare function doesNotReject(fn: () => Promise<any>, message?: string): Promise<void>;
/** Alias for {@link ok}. */
export declare const assert: typeof ok;
//# sourceMappingURL=assert.d.ts.map