/**
 * Options accepted by {@link runRemix}.
 */
export interface RunRemixOptions {
    /**
     * Directory used as the working root when resolving project files (default
     * `process.cwd()`).
     */
    cwd?: string;
    /**
     * Override for the Remix version reported by `remix --version`. Defaults to
     * the version of the installed `@remix-run/cli` package.
     */
    remixVersion?: string;
}
/**
 * Entry point for the `remix` CLI. Parses `argv`, dispatches to the matching
 * subcommand (`new`, `doctor`, `routes`, `test`, `version`, `completion`,
 * `help`), and resolves with the exit code the process should use.
 *
 * @param argv Argument vector to parse, excluding the node and script paths
 *             (default `process.argv.slice(2)`).
 * @param options Overrides for CLI context resolution.
 * @returns The numeric exit code (`0` on success, non-zero on failure).
 *
 * @example
 * ```ts
 * import { runRemix } from '@remix-run/cli'
 *
 * let exitCode = await runRemix(process.argv.slice(2))
 * process.exit(exitCode)
 * ```
 */
export declare function runRemix(argv?: string[], options?: RunRemixOptions): Promise<number>;
//# sourceMappingURL=cli.d.ts.map