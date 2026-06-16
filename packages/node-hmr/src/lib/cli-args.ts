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

interface ResolvedChokidarWatchOptions {
  awaitWriteFinish: {
    pollInterval: number
    stabilityThreshold: number
  }
  depth: number
  ignorePermissionErrors: boolean
  ignored: string[]
  ignoreInitial: boolean
  interval: number
  usePolling: boolean
}

export function resolveChokidarWatchOptions(
  options: NodeHmrWatchOptions = {},
): ResolvedChokidarWatchOptions {
  return {
    awaitWriteFinish: {
      pollInterval: 10,
      stabilityThreshold: 10,
    },
    depth: 0,
    ignorePermissionErrors: true,
    ignored: ['**/.git/**', ...(options.ignore ?? [])],
    ignoreInitial: true,
    interval: options.pollInterval ?? 100,
    usePolling: options.poll ?? process.platform === 'win32',
  }
}
