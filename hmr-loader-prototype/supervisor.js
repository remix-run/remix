// supervisor.js - Minimal process supervisor for HMR + restart
import { fork } from 'child_process'
import { watch } from 'chokidar'
import { pathToFileURL } from 'url'

console.log('[SUPERVISOR] Starting Remix dev supervisor...\n')

// Configuration: what gets HMR vs restart
const config = {
  hmr: ['handler.js'], // HMR boundaries
  restart: ['server.js', 'middleware.js'], // Infrastructure
  entry: './server.js',
}

let worker = null
let isRestarting = false

function startWorker() {
  console.log('[SUPERVISOR] Starting worker process...')

  worker = fork(config.entry, [], {
    execArgv: ['--loader', './loader.js'],
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })

  worker.on('exit', (code) => {
    if (!isRestarting) {
      console.log(`[SUPERVISOR] Worker exited with code ${code}`)
    }
  })

  console.log('[SUPERVISOR] Worker started\n')
}

function restartWorker(reason) {
  console.log(`\n[SUPERVISOR] ⚠️  Restarting server: ${reason}`)
  isRestarting = true

  if (worker) {
    worker.kill()
  }

  // Brief delay to ensure clean shutdown
  setTimeout(() => {
    isRestarting = false
    startWorker()
  }, 100)
}

// Watch all files (both HMR and restart)
const watcher = watch([...config.hmr, ...config.restart], {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 100,
  },
})

watcher.on('change', (file) => {
  if (isRestarting) {
    // During restart, queue changes for after restart completes
    return
  }

  if (config.hmr.includes(file)) {
    // HMR file - send to worker for hot reload
    console.log(`\n[SUPERVISOR] 🔥 HMR file changed: ${file}`)
    if (worker && worker.connected) {
      let msg = {
        type: 'hmr',
        file: pathToFileURL(file).href,
        timestamp: Date.now(),
      }
      console.log(`[SUPERVISOR] Sending IPC message:`, msg)
      worker.send(msg)
    } else {
      console.log(`[SUPERVISOR] Worker not connected, cannot send HMR message`)
    }
  } else if (config.restart.includes(file)) {
    // Infrastructure file - full restart required
    restartWorker(`${file} changed`)
  }
})

console.log('[SUPERVISOR] File watcher initialized')
console.log('[SUPERVISOR] Watching for changes:')
console.log(`  HMR:     ${config.hmr.join(', ')}`)
console.log(`  Restart: ${config.restart.join(', ')}\n`)

// Start initial worker
startWorker()

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SUPERVISOR] Shutting down...')
  watcher.close()
  if (worker) {
    worker.kill()
  }
  process.exit(0)
})
