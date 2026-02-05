// @remix-run/watch - File watcher with HMR for Remix applications

import { fork, type ChildProcess } from 'node:child_process'
import { watch } from 'chokidar'
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'

export interface WatcherOptions {
  args?: string[]
  loaderPath?: string
  ignore?: string[] // Patterns to exclude from watching (e.g., '**/test/**')
  watch?: string[] // Additional files to watch (e.g., files loaded via fs.readFile)
}

export interface Watcher {
  stop(): Promise<void>
}

export async function startWatcher(
  entryPoint: string,
  options: WatcherOptions = {},
): Promise<Watcher> {
  console.log('🔍 Starting remix-watch...\n')

  let entryPath = resolve(entryPoint)
  let loaderPath = options.loaderPath || new URL('./loader.ts', import.meta.url).pathname

  let worker: ChildProcess | null = null
  let isRestarting = false

  // Module graph: url -> { importers, imports, isComponent, filePath }
  let moduleGraph = new Map<
    string,
    {
      importers: Set<string>
      imports: Set<string>
      isComponent: boolean
      filePath: string
    }
  >()

  // Files that are currently being watched
  let watchedFiles = new Set<string>()

  function startWorker() {
    console.log('▶️  Starting server...')

    worker = fork(entryPath, options.args || [], {
      execArgv: ['--loader', loaderPath],
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    })

    worker.on('exit', (code) => {
      if (!isRestarting) {
        console.log(`\n⚠️  Server exited with code ${code}`)
      }
    })

    // Listen for module updates from the runtime
    worker.on('message', (msg: any) => {
      if (msg.type === 'module-update') {
        // Update module graph
        if (!moduleGraph.has(msg.url)) {
          moduleGraph.set(msg.url, {
            importers: new Set(),
            imports: new Set(),
            isComponent: false,
            filePath: msg.filePath,
          })
        }

        let entry = moduleGraph.get(msg.url)!
        entry.isComponent = msg.isComponent
        entry.filePath = msg.filePath

        // Update importers
        entry.importers = new Set(msg.importers)

        // Add file to watcher if not already watching
        if (!watchedFiles.has(msg.filePath)) {
          // Ignore node_modules by default
          let defaultIgnorePatterns = ['node_modules']

          // Check if file should be ignored (default patterns + user patterns)
          let allIgnorePatterns = [...defaultIgnorePatterns, ...(options.ignore || [])]
          let shouldIgnore = allIgnorePatterns.some((pattern) => msg.filePath.includes(pattern))

          // Also ignore files outside the current working directory (e.g., monorepo packages)
          // This prevents watching the entire monorepo when running a demo/app
          if (!shouldIgnore) {
            let cwd = process.cwd()
            let isOutsideWorkspace = !msg.filePath.startsWith(cwd)
            shouldIgnore = isOutsideWorkspace
          }

          if (!shouldIgnore) {
            watcher.add(msg.filePath)
            watchedFiles.add(msg.filePath)
          }
        }
      }
    })

    console.log('✅ Server started\n')
  }

  function restartWorker(reason: string) {
    console.log(`\n⚠️  Restarting: ${reason}`)
    isRestarting = true

    if (worker) {
      // Wait for the worker to actually exit before starting a new one
      worker.once('exit', () => {
        isRestarting = false
        startWorker()
      })

      worker.kill()
    } else {
      isRestarting = false
      startWorker()
    }
  }

  // Walk up the module graph to find components that are affected by a change
  function findAffectedComponents(changedUrl: string): Set<string> {
    let components = new Set<string>()
    let visited = new Set<string>()

    function walk(url: string) {
      if (visited.has(url)) return
      visited.add(url)

      let entry = moduleGraph.get(url)
      if (!entry) return

      // If this module is a component, we found one
      if (entry.isComponent) {
        components.add(url)
        // Don't walk further - components stop propagation
        return
      }

      // Walk up to importers
      for (let importer of entry.importers) {
        walk(importer)
      }
    }

    walk(changedUrl)
    return components
  }

  // Initialize watcher with optional additional files only
  // Discovered modules will be added dynamically as they're loaded
  let watcher = watch(options.watch || [], {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100,
    },
  })

  // If additional files were provided, track them
  if (options.watch) {
    for (let file of options.watch) {
      watchedFiles.add(resolve(file))
    }
  }

  watcher.on('change', (filePath) => {
    if (isRestarting) {
      return // During restart, changes are handled by new worker
    }

    // Find the module URL for this file path
    let moduleUrl: string | undefined
    for (let [url, entry] of moduleGraph.entries()) {
      if (entry.filePath === filePath) {
        moduleUrl = url
        break
      }
    }

    if (!moduleUrl) {
      // File not in module graph - might be an additional watched file
      // Trigger restart to be safe
      restartWorker(`${filePath} changed`)
      return
    }

    let moduleEntry = moduleGraph.get(moduleUrl)

    // Only trigger HMR if the changed file itself is a component
    // If it's a non-component (util, config, etc.), always restart
    if (moduleEntry?.isComponent) {
      // Dead-code detection: if this component has no importers, skip HMR
      if (moduleEntry.importers.size === 0) {
        console.log(`\n⚠️  ${filePath} changed but has no importers - skipping HMR`)
        return
      }

      // File is a component - walk up to find all affected components
      let affectedComponents = findAffectedComponents(moduleUrl)

      console.log(`\n🔥 ${filePath}`)
      if (worker && worker.connected) {
        for (let componentUrl of affectedComponents) {
          worker.send({
            type: 'hmr',
            file: componentUrl,
            timestamp: Date.now(),
          })
        }
      }
    } else {
      // File is not a component (util, server code, etc.)
      // Full restart required
      restartWorker(`${filePath} changed`)
    }
  })

  console.log('👀 Watching for changes...\n')

  // Start initial worker
  startWorker()

  function stop(): Promise<void> {
    return new Promise((resolve) => {
      function done() {
        resolve()
      }
      watcher.close().then(() => {
        if (worker) {
          worker.once('exit', done)
          worker.kill()
        } else {
          done()
        }
      })
    })
  }

  // Graceful shutdown on SIGINT (e.g. Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...')
    stop().then(() => process.exit(0))
  })

  return { stop }
}
