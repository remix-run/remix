/**
 * File Watcher for HMR
 *
 * Watches directories for file changes and notifies subscribers.
 * Uses chokidar for reliable cross-platform file watching.
 */

import * as path from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import picomatch from 'picomatch'

export interface WatcherOptions {
  /** Directory to watch (absolute path) */
  root: string
  /** Allow glob patterns - only notify for files matching these patterns */
  allowPatterns?: string[]
  /** Deny glob patterns - never notify for files matching these patterns */
  denyPatterns?: string[]
}

export interface FileChangeEvent {
  /** The relative path from root (e.g., 'app/Counter.js') */
  relativePath: string
  /** Timestamp of the change */
  timestamp: number
}

export type FileChangeCallback = (event: FileChangeEvent) => void

export interface HmrWatcher {
  /** Start watching for file changes */
  start(): void
  /** Stop watching */
  stop(): Promise<void>
  /** Register a callback for file changes */
  onFileChange(callback: FileChangeCallback): void
}

/**
 * Create a file watcher for HMR.
 *
 * @param options The watcher configuration options
 * @returns An HMR file watcher
 */
export function createWatcher(options: WatcherOptions): HmrWatcher {
  let { root, allowPatterns = [], denyPatterns = [] } = options

  let watcher: FSWatcher | null = null
  let callbacks: FileChangeCallback[] = []

  // Compile glob matchers once for performance
  let allowMatchers = allowPatterns.map((pattern) => picomatch(pattern, { dot: true }))
  let denyMatchers = denyPatterns.map((pattern) => picomatch(pattern, { dot: true }))

  function handleChange(filePath: string) {
    // Calculate relative path from root for pattern matching
    let relativePath = path.relative(root, filePath)
    // Normalize to forward slashes
    relativePath = relativePath.split(path.sep).join('/')

    // Check deny patterns first
    if (denyMatchers.length > 0) {
      let denied = denyMatchers.some((matcher) => matcher(relativePath))
      if (denied) {
        return // Don't notify if file matches deny patterns
      }
    }

    // Check if file matches allow patterns
    if (allowMatchers.length > 0) {
      let matches = allowMatchers.some((matcher) => matcher(relativePath))
      if (!matches) {
        return // Don't notify if file doesn't match allow patterns
      }
    }

    let event: FileChangeEvent = {
      relativePath,
      timestamp: Date.now(),
    }

    // Notify all callbacks
    for (let callback of callbacks) {
      try {
        callback(event)
      } catch (error) {
        console.error('[HMR] Error in file change callback:', error)
      }
    }
  }

  return {
    start() {
      if (watcher) return // Already started

      watcher = watch(root, {
        ignoreInitial: true,
        // Ignore function prevents traversal into these directories entirely
        // This is critical for performance in monorepos - without this, chokidar
        // would traverse into node_modules and follow all symlinks to workspace packages
        ignored: (testPath: string) => {
          let basename = path.basename(testPath)
          return basename === 'node_modules' || basename === '.git'
        },
      })

      watcher.on('change', handleChange)
      watcher.on('add', handleChange)

      console.log(`[HMR] Watching ${root} for changes...`)
    },

    async stop() {
      if (watcher) {
        await watcher.close()
        watcher = null
      }
    },

    onFileChange(callback: FileChangeCallback) {
      callbacks.push(callback)
    },
  }
}
