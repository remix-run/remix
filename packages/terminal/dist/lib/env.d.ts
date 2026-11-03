/**
 * Environment variables used to decide terminal behavior.
 */
export type TerminalEnvironment = Record<string, string | undefined>;
/**
 * Options that control ANSI color detection.
 */
export interface ColorSupportOptions {
    /**
     * Output stream whose TTY support should be used for color detection (defaults to `process.stdout`).
     */
    stream?: {
        /**
         * Whether the output stream is attached to a TTY.
         */
        readonly isTTY?: boolean;
    };
    /**
     * Environment variables used for color detection (defaults to `process.env`).
     */
    env?: TerminalEnvironment;
}
/**
 * Returns `true` when ANSI colors should be emitted for the given stream/environment.
 *
 * @param options Color detection options
 * @returns `true` when ANSI colors should be emitted
 */
export declare function shouldUseColors(options?: ColorSupportOptions): boolean;
/**
 * Returns the current process environment when it is available.
 *
 * @returns Current process environment variables, or an empty object outside Node-compatible runtimes.
 */
export declare function getDefaultEnvironment(): TerminalEnvironment;
//# sourceMappingURL=env.d.ts.map