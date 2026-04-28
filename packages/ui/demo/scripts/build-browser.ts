import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import { discoverExampleFiles } from '../app/examples/discovery.ts'

const DEMO_DIRECTORY = url.fileURLToPath(new URL('..', import.meta.url))
const OUTPUT_DIRECTORY = path.join(DEMO_DIRECTORY, 'public/assets')
const ENTRY_FILE = path.join(DEMO_DIRECTORY, 'app/assets/entry.tsx')
const THEME_BUILDER_ENTRY_FILE = path.join(DEMO_DIRECTORY, 'app/theme-builder.tsx')
const EXAMPLES_DIRECTORY = path.join(DEMO_DIRECTORY, 'app/examples')

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
  let watcher = watchExampleDirectory(() => {
    void refreshWatchState()
  })

  let refreshPromise: Promise<void> | undefined

  function refreshWatchState() {
    if (refreshPromise) return refreshPromise

    refreshPromise = (async () => {
      let nextFingerprint = createExampleFingerprint()
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
    ['theme-builder', THEME_BUILDER_ENTRY_FILE],
    ...discoverExampleFiles().map((example) => [
      path.posix.join('examples', example.relativePath.replace(/\.tsx$/, '')),
      example.absolutePath,
    ]),
  ]) as Record<string, string>
}

function createExampleFingerprint() {
  return discoverExampleFiles()
    .map((example) => example.relativePath)
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
    fingerprint: createExampleFingerprint(),
  }
}

async function waitForStop(getContext: () => esbuild.BuildContext, watcher?: fs.FSWatcher) {
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

function watchExampleDirectory(onChange: () => void) {
  return fs.watch(EXAMPLES_DIRECTORY, { recursive: true }, () => {
    onChange()
  })
}
