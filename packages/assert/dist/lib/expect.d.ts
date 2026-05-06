interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeTruthy(): void;
    toBeInstanceOf(ctor: Function): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toBeCloseTo(n: number, precision?: number): void;
    toContain(item: unknown): void;
    toMatch(re: RegExp | string): void;
    toHaveLength(n: number): void;
    toHaveProperty(key: string, value?: unknown): void;
    toMatchObject(expected: object): void;
    toThrow(expected?: unknown): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(n: number): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    toHaveBeenNthCalledWith(nth: number, ...args: unknown[]): void;
}
interface AsyncMatchers {
    toBe(expected: unknown): Promise<void>;
    toEqual(expected: unknown): Promise<void>;
    toBeNull(): Promise<void>;
    toBeUndefined(): Promise<void>;
    toBeDefined(): Promise<void>;
    toBeTruthy(): Promise<void>;
    toBeInstanceOf(ctor: Function): Promise<void>;
    toBeGreaterThan(n: number): Promise<void>;
    toBeGreaterThanOrEqual(n: number): Promise<void>;
    toBeLessThan(n: number): Promise<void>;
    toBeLessThanOrEqual(n: number): Promise<void>;
    toBeCloseTo(n: number, precision?: number): Promise<void>;
    toContain(item: unknown): Promise<void>;
    toMatch(re: RegExp | string): Promise<void>;
    toHaveLength(n: number): Promise<void>;
    toHaveProperty(key: string, value?: unknown): Promise<void>;
    toMatchObject(expected: object): Promise<void>;
    toThrow(expected?: unknown): Promise<void>;
}
export interface Expectation extends Matchers {
    not: Matchers;
    rejects: AsyncMatchers;
    resolves: AsyncMatchers;
}
/**
 * jest/vitest-style expect API. Returns an object of matchers that throw
 * {@link AssertionError} on failure. Supports `.not` for negation and
 * `.rejects` / `.resolves` for asserting on promises.
 *
 * Mock-aware matchers (`toHaveBeenCalled*`) read `received.mock.calls[i].arguments`,
 * which is the shape produced by `mock.fn()` from `@remix-run/test`.
 *
 * @example
 * expect(value).toBe(42)
 * expect(value).not.toBeNull()
 * await expect(fetch('/missing')).rejects.toThrow('Not found')
 * await expect(loadModule()).resolves.toBeUndefined()
 *
 * @param received - The value or function or promise to assert against.
 * @returns An {@link Expectation} object exposing matchers, `.not`,
 *          `.rejects`, and `.resolves`.
 */
declare function expectImpl(received: unknown): Expectation;
/**
 * Asymmetric matcher used as the `expected` value in `toEqual`. The actual
 * value passes if it has at least the keys in `expected` (with matching
 * values) — extra keys are allowed.
 *
 * @example
 * expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 }))
 *
 * @param expected - Subset of keys (and values) the actual value must contain.
 * @returns A sentinel-tagged object `toEqual` recognizes as a partial matcher.
 */
declare function objectContaining<T extends object>(expected: T): T;
export declare const expect: typeof expectImpl & {
    objectContaining: typeof objectContaining;
};
export {};
//# sourceMappingURL=expect.d.ts.map