import type { TestContext } from './context.ts';
type LifecycleHookFn = () => void | Promise<void>;
type PendingMeta = boolean | string;
interface TestOptions {
    timeout?: number;
    signal?: AbortSignal;
}
interface HookOptions {
    timeout?: number;
    signal?: AbortSignal;
}
declare function describeImpl(name: string, fn: () => void): void;
declare function describeImpl(name: string, meta: SuiteMeta, fn: () => void): void;
/**
 * Groups related tests into a named suite. Suites can be nested and will be displayed
 * as such in reporter output. Lifecycle hooks registered inside
 * a `describe` block apply only to tests within that block.
 *
 * @example
 * describe('auth', () => {
 *   it('logs in', async () => { ... })
 * })
 * describe('external service', { skip: 'requires API credentials' }, () => { ... })
 *
 * // Modifiers
 * describe.skip('skipped suite', () => { ... })
 * describe.skip('skipped suite', 'blocked by missing fixture', () => { ... })
 * describe.only('focused suite', () => { ... })
 * describe.todo('planned suite')
 * describe.todo('planned suite', 'needs design input')
 *
 * @param name - The suite name shown in reporter output.
 * @param meta - Suite metadata such as `skip`, `only`, or `todo`.
 * @param fn - A function that registers the tests and lifecycle hooks in this suite.
 */
export declare const describe: typeof describeImpl & {
    skip: typeof describeSkip;
    only: (name: string, fn: () => void) => void;
    todo: typeof describeTodo;
};
type SuiteMeta = {
    skip?: PendingMeta;
    only?: boolean;
    todo?: PendingMeta;
};
type TestMeta = TestOptions & {
    skip?: PendingMeta;
    only?: boolean;
    todo?: PendingMeta;
};
type TestFn = (t: TestContext) => void | Promise<void>;
declare function itImpl(name: string, fn: TestFn): void;
declare function itImpl(name: string, meta: TestMeta, fn: TestFn): void;
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
 * it.skip('not ready yet', 'blocked by missing fixture')
 * it.only('focused test', () => { ... })
 * it.todo('coming soon')
 * it.todo('coming soon', 'needs retry coverage')
 * it('fails if it takes too long', { timeout: 5_000 }, async (t) => {
 *   await fetch('/api/data', { signal: t.signal })
 * })
 *
 * @param name - The test name shown in reporter output.
 * @param meta - Test metadata such as `skip`, `only`, `todo`, `timeout`, or `signal`.
 * @param fn - The test body, receiving a {@link TestContext} as its first argument.
 */
export declare const it: typeof itImpl & {
    skip: typeof itSkip;
    only: (name: string, fn: TestFn) => void;
    todo: typeof itTodo;
};
/** Alias for {@link describe}. */
export declare const suite: typeof describeImpl & {
    skip: typeof describeSkip;
    only: (name: string, fn: () => void) => void;
    todo: typeof describeTodo;
};
/** Alias for {@link it}. */
export declare const test: typeof itImpl & {
    skip: typeof itSkip;
    only: (name: string, fn: TestFn) => void;
    todo: typeof itTodo;
};
declare function describeSkip(name: string, fn: () => void): void;
declare function describeSkip(name: string, reason: string, fn: () => void): void;
declare function describeTodo(name: string, reason?: string): void;
declare function itSkip(name: string): void;
declare function itSkip(name: string, fn: TestFn): void;
declare function itSkip(name: string, reason: string): void;
declare function itSkip(name: string, reason: string, fn: TestFn): void;
declare function itTodo(name: string, reason?: string): void;
/**
 * Registers a hook that runs before **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * registration order. Pass `{ timeout, signal }` after the function to limit
 * how long the hook may run.
 *
 * @param fn - The setup function to run before each test.
 * @param options - Optional timeout and abort signal configuration.
 */
export declare function beforeEach(fn: LifecycleHookFn, options?: HookOptions): void;
/**
 * Registers a hook that runs after **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order.  To run logic after a singular test, use
 * `t.after()` from the {@link TestContext}. Pass `{ timeout, signal }` after
 * the function to limit how long the hook may run.
 *
 * @param fn - The teardown function to run after each test.
 * @param options - Optional timeout and abort signal configuration.
 */
export declare function afterEach(fn: LifecycleHookFn, options?: HookOptions): void;
/**
 * Registers a hook that runs once before **all** tests in the current suite
 * (or globally if called outside a `describe`). Multiple calls are chained in
 * registration order. Pass `{ timeout, signal }` after the function to limit
 * how long the hook may run.
 *
 * @param fn - The setup function to run once before all tests in the suite.
 * @param options - Optional timeout and abort signal configuration.
 */
export declare function beforeAll(fn: LifecycleHookFn, options?: HookOptions): void;
/**
 * Registers a hook that runs once after **all** tests in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order. Pass `{ timeout, signal }` after the function
 * to limit how long the hook may run.
 *
 * @param fn - The teardown function to run once after all tests in the suite.
 * @param options - Optional timeout and abort signal configuration.
 */
export declare function afterAll(fn: LifecycleHookFn, options?: HookOptions): void;
/** Alias for {@link beforeAll} — matches the `node:test` API. */
export declare const before: typeof beforeAll;
/** Alias for {@link afterAll} — matches the `node:test` API. */
export declare const after: typeof afterAll;
export {};
//# sourceMappingURL=framework.d.ts.map