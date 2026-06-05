import * as esbuild from 'esbuild'
import path from 'node:path'
import url from 'node:url'

import { discoverDemoFiles } from '../app/demo-runner/discovery.ts'

const DEMO_DIRECTORY = url.fileURLToPath(new URL('..', import.meta.url))
const OUTPUT_DIRECTORY = path.join(DEMO_DIRECTORY, 'public/assets')
const ENTRY_FILE = path.join(DEMO_DIRECTORY, 'app/assets/entry.tsx')

const buildOptions: esbuild.BuildOptions = {
  bundle: true,
  chunkNames: 'chunks/[name]-[hash]',
  format: 'esm',
  logLevel: 'info',
  outdir: OUTPUT_DIRECTORY,
  platform: 'browser',
  splitting: true,
  sourcemap: true,
}

if (process.argv.includes('--watch')) {
  let watchState = await createWatchState()
  let watcher = watchDemoFiles(() => {
    void refreshWatchState()
  })

  let refreshPromise: Promise<void> | undefined

  function refreshWatchState() {
    if (refreshPromise) return refreshPromise

    refreshPromise = (async () => {
      let nextFingerprint = createDemoFingerprint()
      if (nextFingerprint === watchState.fingerprint) return

      console.log('Refreshing browser entry points...')
      await watchState.context.dispose()
      watchState = await createWatchState()
    })().finally(() => {
      refreshPromise = undefined
    })

    return refreshPromise
  }

  console.log('Watching browser assets...')
  await waitForStop(() => watchState.context, watcher)
} else {
  await esbuild.build({
    ...buildOptions,
    entryPoints: createEntryPoints(),
  })
}

function createEntryPoints() {
  return Object.fromEntries([
    ['entry', ENTRY_FILE],
    ...discoverDemoFiles().map((demo) => [
      path.posix.join('demos', demo.relativePath.replace(/\.demo\.(tsx|ts)$/, '')),
      demo.absolutePath,
    ]),
  ]) as Record<string, string>
}

function createDemoFingerprint() {
  return discoverDemoFiles()
    .map((demo) => demo.relativePath)
    .join('|')
}

async function createWatchState() {
  let context = await esbuild.context({
    ...buildOptions,
    entryPoints: createEntryPoints(),
  })

  await context.watch()

  return {
    context,
    fingerprint: createDemoFingerprint(),
  }
}

async function waitForStop(getContext: () => esbuild.BuildContext, watcher?: { close(): void }) {
  await new Promise<void>((resolve) => {
    let shuttingDown = false

    let shutdown = async () => {
      if (shuttingDown) return
      shuttingDown = true
      watcher?.close()
      await getContext().dispose()
      resolve()
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })
}

function watchDemoFiles(onChange: () => void) {
  let interval = setInterval(() => {
    onChange()
  }, 1000)

  return {
    close() {
      clearInterval(interval)
    },
  }
}
