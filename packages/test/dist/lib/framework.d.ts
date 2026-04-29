import type { TestContext } from './context.ts';
/**
 * Groups related tests into a named suite. Suites can be nested snd will be displayed
 * as such or joined with ` > ` in reporter output. Lifecycle hooks registered inside
 * a `describe` block apply only to tests within that block.
 *
 * @example
 * describe('auth', () => {
 *   it('logs in', async () => { ... })
 * })
 *
 * // Modifiers
 * describe.skip('skipped suite', () => { ... })
 * describe.only('focused suite', () => { ... })
 * describe.todo('planned suite')
 *
 * @param name - The suite name shown in reporter output.
 * @param fn - A function that registers the tests and lifecycle hooks in this suite.
 */
export declare const describe: ((name: string, metaOrFn: SuiteMeta | (() => void), fn?: (() => void) | undefined) => void) & {
    skip: (name: string, fn: () => void) => void;
    only: (name: string, fn: () => void) => void;
    todo: (name: string) => void;
};
type SuiteMeta = {
    skip?: boolean;
    only?: boolean;
};
type TestMeta = {
    skip?: boolean;
    only?: boolean;
};
type TestFn = (t: TestContext) => void | Promise<void>;
/**
 * Defines a single test case. The optional `TestContext` argument `t` provides
 * mock helpers and per-test cleanup registration.
 *
 * @example
 * it('returns 200 for the home route', async () => {
 *   const res = await router.fetch('/')
 *   assert.equal(res.status, 200)
 * })
 *
 * // Modifiers
 * it.skip('not ready yet', () => { ... })
 * it.only('focused test', () => { ... })
 * it.todo('coming soon')
 *
 * @param name - The test name shown in reporter output.
 * @param fn - The test body, receiving a {@link TestContext} as its first argument.
 */
export declare const it: ((name: string, metaOrFn: TestFn | TestMeta, fn?: TestFn | undefined) => void) & {
    skip: (name: string, fn?: TestFn | undefined) => void;
    only: (name: string, fn: TestFn) => void;
    todo: (name: string) => void;
};
/** Alias for {@link describe}. */
export declare const suite: ((name: string, metaOrFn: SuiteMeta | (() => void), fn?: (() => void) | undefined) => void) & {
    skip: (name: string, fn: () => void) => void;
    only: (name: string, fn: () => void) => void;
    todo: (name: string) => void;
};
/** Alias for {@link it}. */
export declare const test: ((name: string, metaOrFn: TestFn | TestMeta, fn?: TestFn | undefined) => void) & {
    skip: (name: string, fn?: TestFn | undefined) => void;
    only: (name: string, fn: TestFn) => void;
    todo: (name: string) => void;
};
/**
 * Registers a hook that runs before **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * registration order.
 *
 * @param fn - The setup function to run before each test.
 */
export declare function beforeEach(fn: () => void | Promise<void>): void;
/**
 * Registers a hook that runs after **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order.  To run logic after a singular test, use
 * `t.after()` from the {@link TestContext}
 *
 * @param fn - The teardown function to run after each test.
 */
export declare function afterEach(fn: () => void | Promise<void>): void;
/**
 * Registers a hook that runs once before **all** tests in the current suite
 * (or globally if called outside a `describe`). Multiple calls are chained in
 * registration order.
 *
 * @param fn - The setup function to run once before all tests in the suite.
 */
export declare function beforeAll(fn: () => void | Promise<void>): void;
/**
 * Registers a hook that runs once after **all** tests in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order.
 *
 * @param fn - The teardown function to run once after all tests in the suite.
 */
export declare function afterAll(fn: () => void | Promise<void>): void;
/** Alias for {@link beforeAll} — matches the `node:test` API. */
export declare const before: typeof beforeAll;
/** Alias for {@link afterAll} — matches the `node:test` API. */
export declare const after: typeof afterAll;
export {};
//# sourceMappingURL=framework.d.ts.map