/**
 * Unbundled build for the assets demo.
 * Uses @remix-run/assets to build the module graph (same output structure as dev).
 *
 * Usage:
 *   pnpm run build
 */

import { build } from '@remix-run/assets'
import { files } from './assets.ts'

async function main() {
  await build({
    scripts: ['app/entry.tsx'],
    workspaceRoot: '../..',
    outDir: './build/assets',
    baseUrl: '/assets',
    minify: true,
    sourcemap: 'external',
    fileNames: '[dir]/[name]-[hash]',
    manifest: './build/assets-manifest.json',
    files,
  })
  console.log('Outputs written to ./build/assets')
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
