/**
 * Unbundled build for the assets demo.
 * Uses @remix-run/assets to build the module graph (same output structure as dev).
 *
 * Usage:
 *   pnpm run build
 */

import { build } from '@remix-run/assets'
import { esbuildConfig } from './esbuild.config.ts'

async function main() {
  await build({
    entryPoints: ['app/entry.tsx'],
    root: process.cwd(),
    outDir: './build/assets',
    esbuildConfig,
    fileNames: '[dir]/[name]-[hash]',
    manifest: './build/assets-manifest.json',
    workspace: { root: '../..' },
  })
  console.log('Outputs written to ./build/assets')
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
