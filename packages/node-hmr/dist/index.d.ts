export type { ImportMetaHot } from './lib/runtime.ts';
/**
 * Options for running a Node.js entry module with HMR supervision.
 */
export interface RunOptions {
    /** Browser HMR channel configuration, or `false` to disable browser coordination. */
    browserHmrChannel?: boolean | BrowserHmrChannelOptions;
    /** Working directory used to resolve the entry path and relative watch options. */
    cwd?: string;
    /** Arguments passed to the entry module after the entry path. */
    entryArgs?: readonly string[];
    /** Environment variables passed to the child process. */
    env?: NodeJS.ProcessEnv;
    /** Node.js arguments passed before the entry path. */
    nodeArgs?: readonly string[];
    /** File watching options for the supervised process. */
    watch?: NodeHmrWatchOptions;
}
/**
 * Browser HMR event stream options hosted by the parent process.
 */
export interface BrowserHmrChannelOptions {
    /** Hostname for the browser HMR event server. */
    host?: string;
    /** Port for the browser HMR event server. */
    port?: number;
    /** URL pathname for the browser HMR event stream. */
    pathname?: string;
}
/**
 * File watching options for a Node HMR runner.
 */
export interface NodeHmrWatchOptions {
    /**
     * Ignore matching glob patterns or file paths. Relative values are resolved
     * from the runner's `cwd`.
     */
    ignore?: readonly string[];
    /**
     * Use polling instead of native filesystem events. Defaults to `true` on
     * Windows and `false` elsewhere.
     */
    poll?: boolean;
    /**
     * Polling interval in milliseconds when `poll` is enabled. Defaults to `100`.
     */
    pollInterval?: number;
}
/**
 * Handle returned by {@link run} for controlling the supervised process.
 */
export interface NodeHmrRunner {
    /**
     * Stops the runner and waits for the child process to exit.
     *
     * @returns A promise that resolves once the runner has stopped.
     */
    close(): Promise<void>;
    /**
     * Current child process lifecycle generation.
     */
    readonly generation: number;
    /**
     * Waits until the current child process is ready.
     *
     * @returns A promise that resolves when the current generation is ready.
     */
    ready(): Promise<void>;
}
type HmrReadyFetchRetryContext = {
    /** Child process lifecycle generation that handled the fetch attempt. */
    generation: number;
    /** Request passed to the wrapped fetch handler. */
    request: Request;
} & ({
    /** Error thrown by the wrapped fetch handler. */
    error: unknown;
    /** Response is absent when the wrapped fetch handler throws. */
    response?: never;
} | {
    /** Error is absent when the wrapped fetch handler returns a response. */
    error?: never;
    /** Response returned by the wrapped fetch handler. */
    response: Response;
});
/**
 * Options for {@link createHmrReadyFetch}.
 */
export interface HmrReadyFetchOptions {
    /**
     * Determines whether a response or thrown error should be retried if the
     * runner moves to a new generation while the request is in flight. Defaults
     * to retrying `GET` and `HEAD` requests when the fetch throws or returns
     * `502`, `503`, or `504`.
     */
    shouldRetry?: (context: HmrReadyFetchRetryContext) => boolean | Promise<boolean>;
}
/**
 * Wraps a fetch handler so requests wait for the current HMR generation to be ready.
 *
 * If the wrapped fetch handler returns a retryable response or throws a retryable error, the
 * request is attempted again only when the runner moved to a new generation while the request was
 * in flight.
 *
 * @param runner HMR runner that controls server readiness.
 * @param fetch Fetch handler to call once the runner is ready.
 * @param options Retry behavior for responses and thrown errors.
 * @returns A fetch handler that waits for HMR readiness before forwarding requests.
 */
export declare function createHmrReadyFetch(runner: NodeHmrRunner, fetch: (request: Request) => Response | Promise<Response>, options?: HmrReadyFetchOptions): (request: Request) => Promise<Response>;
/**
 * Starts a Node.js entry module under HMR supervision.
 *
 * @param entry Entry module path to run.
 * @param options Runner options.
 * @returns A runner handle for the supervised process.
 */
export declare function run(entry: string, options?: RunOptions): NodeHmrRunner;
//# sourceMappingURL=index.d.ts.map