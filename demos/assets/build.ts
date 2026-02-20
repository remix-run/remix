/**
 * Unbundled build for the assets demo.
 * Uses @remix-run/assets to build the module graph (same output structure as dev).
 *
 * Usage:
 *   pnpm run build
 */

import { build } from '@remix-run/assets'
import { buildConfig } from './assets.ts'

async function main() {
  await build(buildConfig)
  console.log('Outputs written to ./build/assets')
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
