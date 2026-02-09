/**
 * Unbundled build for the bookstore demo.
 * Uses remix/assets to build the module graph (same output structure as dev).
 *
 * Usage:
 *   pnpm run build
 */

import { build } from 'remix/assets'
import { getEsbuildConfig } from './esbuild.config.ts'

async function main() {
  let config = await getEsbuildConfig()
  let entryPoints = config.entryPoints as string[]

  console.log('Entry points:')
  for (let entry of entryPoints) {
    console.log(`  ${entry}`)
  }
  console.log('')

  await build({
    entryPoints,
    root: process.cwd(),
    outDir: './build/assets',
    esbuildConfig: config,
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
