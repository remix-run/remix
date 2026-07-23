import { type RemixTestConfig } from './lib/config.ts';
export { remixTestPools, type RemixTestPool } from './lib/config.ts';
/**
 * Options accepted by {@link runRemixTest}.
 */
export interface RunRemixTestOptions extends RemixTestConfig {
    /**
     * Path to a test configuration file, resolved from `cwd`. When omitted, the runner looks for
     * `remix-test.config.ts` and `remix-test.config.js`.
     */
    config?: string;
    /**
     * Working directory the runner resolves configuration and test files against
     * (`process.cwd()` by default).
     */
    cwd?: string;
}
/**
 * Runs Remix tests using structured invocation options. The runner loads the user's
 * `RemixTestConfig`, discovers test files, and runs them through the server, browser, and E2E
 * pipelines configured by the project. In watch mode, the promise resolves when the user
 * terminates the runner; otherwise, it resolves once the run finishes.
 *
 * @param options Configuration overrides and invocation paths.
 * @returns The exit code the host process should use (`0` on success, `1` on test failure or an
 *          unrecoverable error).
 *
 * @example
 * ```ts
 * import { runRemixTest } from 'remix/test/cli'
 *
 * let exitCode = await runRemixTest({
 *   concurrency: 1,
 *   cwd: process.cwd(),
 *   type: ['server'],
 * })
 * ```
 */
export declare function runRemixTest(options?: RunRemixTestOptions): Promise<number>;
//# sourceMappingURL=cli.d.ts.map