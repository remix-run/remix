/**
 * Unbundled build for the assets demo.
 * Uses @remix-run/assets to build the module graph (same output structure as dev).
 *
 * Usage:
 *   pnpm run build
 */

import { build } from '@remix-run/assets'

async function main() {
  await build({
    entryPoints: ['app/entry.tsx'],
    workspaceRoot: '../..',
    outDir: './build/assets',
    minify: true,
    sourcemap: 'external',
    fileNames: '[dir]/[name]-[hash]',
    manifest: './build/assets-manifest.json',
  })
  console.log('Outputs written to ./build/assets')
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
