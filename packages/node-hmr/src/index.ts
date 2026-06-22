import { fileURLToPath } from 'node:url'
import process from 'node:process'

import { createWatchedProcessController } from './lib/runner.ts'

export type { ImportMetaHot } from './lib/runtime.ts'

export interface RunOptions {
  browserHmrChannel?: boolean | BrowserHmrChannelOptions
  cwd?: string
  entryArgs?: readonly string[]
  env?: NodeJS.ProcessEnv
  nodeArgs?: readonly string[]
  watch?: NodeHmrWatchOptions
}

export interface BrowserHmrChannelOptions {
  host?: string
  port?: number
  pathname?: string
}

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

export interface NodeHmrRunner {
  close(): Promise<void>
  /**
   * Current child process lifecycle generation.
   */
  readonly generation: number
  /**
   * Waits until the current child process is ready.
   */
  ready(): Promise<void>
}

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
