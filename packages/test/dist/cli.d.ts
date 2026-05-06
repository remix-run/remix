import { getRemixTestHelpText } from './lib/config.ts';
export { getRemixTestHelpText };
/**
 * Options accepted by {@link runRemixTest}.
 */
export interface RunRemixTestOptions {
    /**
     * Argument vector to parse. When omitted, `process.argv.slice(2)` is used
     * so the regular CLI flags work transparently.
     */
    argv?: string[];
    /**
     * Working directory the runner resolves config and test files against
     * (default `process.cwd()`).
     */
    cwd?: string;
}
/**
 * Programmatic entry point for the `remix-test` CLI. Loads the user's
 * {@link RemixTestConfig}, discovers test files, and runs them through the
 * server/browser/E2E pipelines configured by the project. In watch mode the
 * promise resolves when the user terminates the runner; otherwise it resolves
 * once the run finishes.
 *
 * @param options Optional overrides for the parsed argv and working directory.
 * @returns The exit code the host process should use (`0` on success, `1` on
 *          test failure or unrecoverable error).
 *
 * @example
 * ```ts
 * import { runRemixTest } from '@remix-run/test/cli'
 *
 * let exitCode = await runRemixTest()
 * process.exit(exitCode)
 * ```
 */
export declare function runRemixTest(options?: RunRemixTestOptions): Promise<number>;
//# sourceMappingURL=cli.d.ts.map