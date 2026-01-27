/**
 * Development server for E2E HMR tests.
 *
 * Manages both:
 * 1. esbuild in watch mode (rebuilds TSX → JS)
 * 2. HMR test server (serves files with HMR transforms)
 *
 * Properly cleans up both on exit.
 */

import * as http from 'node:http'
import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter, type Middleware } from '@remix-run/fetch-router'
import { devAssets } from '../src/index.ts'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let fixturesDir = path.join(__dirname, 'fixtures')
let publicDir = path.join(fixturesDir, 'public')
let appDir = path.join(fixturesDir, 'app')
let packageDir = path.join(__dirname, '..')

let PORT = 44200

// Track child processes for cleanup
let esbuildProcess: ChildProcess | null = null
let server: http.Server | null = null
let shuttingDown = false

function log(message: string) {
  console.log(`[dev-server] ${message}`)
}

function cleanBuildOutput() {
  log('Cleaning build output...')
  let assetsDir = path.join(publicDir, 'assets')
  try {
    execSync(`rm -rf "${assetsDir}"`, { stdio: 'inherit' })
  } catch {
    // Directory might not exist
  }
}

function runInitialBuild() {
  log('Running initial build...')
  try {
    // Clean first to avoid stale artifacts
    cleanBuildOutput()
    execSync('tsx e2e/fixtures/build.ts', {
      cwd: packageDir,
      stdio: 'inherit',
    })
    log('Initial build complete')
  } catch (error) {
    throw new Error('Initial build failed')
  }
}

function startEsbuildWatch() {
  log('Starting esbuild watch...')

  esbuildProcess = spawn('tsx', ['e2e/fixtures/build.ts', '--watch'], {
    cwd: packageDir,
    stdio: 'inherit',
  })

  esbuildProcess.on('error', (error) => {
    console.error('esbuild error:', error)
  })

  esbuildProcess.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      log(`esbuild exited with code ${code}`)
    }
  })
}

function startHttpServer(): Promise<void> {
  return new Promise((resolve) => {
    // Middleware to serve index.html for root path
    let serveIndex: Middleware = async (context, next) => {
      if (context.url.pathname === '/') {
        let html = await fsp.readFile(path.join(publicDir, 'index.html'), 'utf-8')
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
      return next()
    }

    let router = createRouter({
      middleware: [
        serveIndex,
        devAssets({
          root: publicDir,
          allow: [/^assets\//],
          hmr: true,
          workspace: {
            root: path.join(packageDir, '../..'), // monorepo root
            allow: [/node_modules/],
          },
        }),
      ],
    })

    server = http.createServer(
      createRequestListener(async (request) => {
        try {
          return await router.fetch(request)
        } catch (error) {
          console.error(error)
          return new Response('Internal Server Error', { status: 500 })
        }
      }),
    )

    server.listen(PORT, () => {
      log(`HTTP server running at http://localhost:${PORT}`)
      resolve()
    })
  })
}

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true

  log('Shutting down...')

  // Kill esbuild process
  if (esbuildProcess && !esbuildProcess.killed) {
    log('Stopping esbuild...')
    esbuildProcess.kill('SIGTERM')
  }

  // Close HTTP server
  if (server) {
    log('Stopping HTTP server...')
    server.close(() => {
      log('Shutdown complete')
      process.exit(0)
    })

    // Force exit after timeout
    setTimeout(() => {
      log('Force exit')
      process.exit(0)
    }, 3000)
  } else {
    process.exit(0)
  }
}

// Handle shutdown signals
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Main
async function main() {
  try {
    // Run initial build synchronously
    runInitialBuild()

    // Start esbuild watch in background (for subsequent rebuilds)
    startEsbuildWatch()

    // Start HTTP server
    await startHttpServer()

    log('Ready for tests')
  } catch (error) {
    console.error('Failed to start dev server:', error)
    shutdown()
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
