/**
 * Unbundled build for the bookstore demo.
 * Uses remix/assets to build the module graph (same output structure as dev).
 *
 * Usage:
 *   pnpm run build
 */

import { build } from 'remix/assets'
import { getEsbuildConfig } from './esbuild.config.ts'
import { files } from './assets.ts'

async function main() {
  let config = await getEsbuildConfig()
  let scripts = config.entryPoints as string[]

  console.log('Scripts:')
  for (let entry of scripts) {
    console.log(`  ${entry}`)
  }
  console.log('')

  await build({
    scripts,
    files,
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
