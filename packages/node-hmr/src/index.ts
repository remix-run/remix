import { fileURLToPath } from 'node:url'
import process from 'node:process'

import { createWatchedProcessController } from './lib/runner.ts'

export type { ImportMetaHot } from './lib/runtime.ts'

/**
 * Options for running a Node.js entry module with HMR supervision.
 */
export interface RunOptions {
  /** Browser HMR channel configuration, or `false` to disable browser coordination. */
  browserHmrChannel?: boolean | BrowserHmrChannelOptions
  /** Working directory used to resolve the entry path and relative watch options. */
  cwd?: string
  /** Arguments passed to the entry module after the entry path. */
  entryArgs?: readonly string[]
  /** Environment variables passed to the child process. */
  env?: NodeJS.ProcessEnv
  /** Node.js arguments passed before the entry path. */
  nodeArgs?: readonly string[]
  /** File watching options for the supervised process. */
  watch?: NodeHmrWatchOptions
}

/**
 * Browser HMR event stream options hosted by the parent process.
 */
export interface BrowserHmrChannelOptions {
  /** Hostname for the browser HMR event server. */
  host?: string
  /** Port for the browser HMR event server. */
  port?: number
  /** URL pathname for the browser HMR event stream. */
  pathname?: string
}

/**
 * File watching options for a Node HMR runner.
 */
export interface NodeHmrWatchOptions {
  /**
   * Ignore matching glob patterns or file paths. Relative values are resolved
   * from the runner's `cwd`.
   */
  ignore?: readonly string[]
  /**
   * Use polling instead of native filesystem events. Defaults to `true` on
   * Windows and `false` elsewhere.
   */
  poll?: boolean
  /**
   * Polling interval in milliseconds when `poll` is enabled. Defaults to `100`.
   */
  pollInterval?: number
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
  close(): Promise<void>
  /**
   * Current child process lifecycle generation.
   */
  readonly generation: number
  /**
   * Waits until the current child process is ready.
   *
   * @returns A promise that resolves when the current generation is ready.
   */
  ready(): Promise<void>
}

/**
 * Starts a Node.js entry module under HMR supervision.
 *
 * @param entry Entry module path to run.
 * @param options Runner options.
 * @returns A runner handle for the supervised process.
 */
export function run(entry: string, options: RunOptions = {}): NodeHmrRunner {
  let controller = createWatchedProcessController({
    browserHmrChannel: normalizeBrowserHmrChannelOptions(options.browserHmrChannel),
    cwd: options.cwd ?? process.cwd(),
    entry,
    entryArgs: [...(options.entryArgs ?? [])],
    env: options.env ?? process.env,
    nodeArgs: [...(options.nodeArgs ?? [])],
    registerPath: resolveRegisterPath(),
    watch: options.watch,
  })

  let closed = controller.start()
  closed.catch((error: unknown) => {
    console.error(error)
  })

  return {
    close() {
      return controller.stop()
    },

    get generation() {
      return controller.generation
    },

    ready() {
      return controller.ready()
    },
  }
}

function normalizeBrowserHmrChannelOptions(
  options: RunOptions['browserHmrChannel'],
): BrowserHmrChannelOptions | null {
  if (options === false) return null
  if (options === undefined || options === true) return {}

  if (options.port !== undefined) {
    assertValidPort(options.port)
  }

  return options
}

function resolveRegisterPath(): string {
  let extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js'

  return fileURLToPath(new URL(`./register.${extension}`, import.meta.url))
}

function assertValidPort(port: number): void {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError(`Invalid browser HMR channel port: ${port}`)
  }
}
