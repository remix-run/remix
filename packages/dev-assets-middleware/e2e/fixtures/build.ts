/**
 * Build script for E2E test fixtures.
 * Compiles app/*.tsx → public/assets/*.js
 */

import * as esbuild from 'esbuild'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let appDir = path.join(__dirname, 'app')
let outDir = path.join(__dirname, 'public/assets')

let isWatch = process.argv.includes('--watch')

let buildOptions: esbuild.BuildOptions = {
  entryPoints: [
    path.join(appDir, 'entry.tsx'),
    path.join(appDir, 'Counter.tsx'),
    path.join(appDir, 'components.tsx'),
    path.join(appDir, 'utils.ts'),
  ],
  outdir: outDir,
  bundle: true,
  splitting: true,
  format: 'esm',
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  sourcemap: 'inline',
  jsx: 'automatic',
  jsxImportSource: '@remix-run/component',
  external: ['/assets/*'],
  logLevel: 'info',
}

async function main() {
  if (isWatch) {
    let ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('[build] Watching for changes...')
  } else {
    await esbuild.build(buildOptions)
    console.log('[build] Build complete')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
