/**
 * Unbundled build for the bookstore demo.
 * Uses remix/assets to build the module graph (same output structure as dev).
 *
 * Usage:
 *   pnpm run build
 */

import { build } from 'remix/assets'
import { getAssetsBuildConfig } from './assets.config.ts'

async function main() {
  let config = await getAssetsBuildConfig()

  console.log('Scripts:')
  for (let entry of config.scripts) {
    console.log(`  ${entry}`)
  }
  console.log('')

  await build(config)
  console.log(`Outputs written to ${config.outDir}`)
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
