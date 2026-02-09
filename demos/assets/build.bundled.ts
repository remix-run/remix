/**
 * Bundled build for the assets demo.
 * Uses esbuild to bundle the entry point with hashed filenames and a metafile.
 * Outputs to build/assets with locally-scoped manifest (same layout as unbundled build).
 *
 * Usage:
 *   pnpm run build:bundled
 */

import * as esbuild from 'esbuild'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { esbuildConfig } from './esbuild.config.ts'

let outdir = './build/assets'

async function main() {
  await fs.rm(outdir, { recursive: true, force: true })
  await fs.mkdir(outdir, { recursive: true })

  let result = await esbuild.build({
    ...esbuildConfig,
    outdir,
  })

  // Emit manifest with locally-scoped paths (relative to outdir) for assets(manifest, { baseUrl })
  let prefix = 'build/assets/'
  let outputs: Record<string, (typeof result.metafile)['outputs'][string]> = {}
  for (let [outputPath, entry] of Object.entries(result.metafile.outputs)) {
    let localPath = outputPath.startsWith(prefix) ? outputPath.slice(prefix.length) : outputPath
    let imports = entry.imports?.map((imp) => ({
      ...imp,
      path: imp.path.startsWith(prefix) ? imp.path.slice(prefix.length) : imp.path,
    }))
    outputs[localPath] = imports ? { ...entry, imports } : entry
  }
  let manifest = { outputs }

  let manifestPath = './build/assets-manifest.json'
  await fs.mkdir(path.dirname(manifestPath), { recursive: true })
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  console.log('Build complete!')
  console.log('')
  console.log('Outputs:')
  for (let output of Object.keys(result.metafile.outputs)) {
    console.log(`  ${output}`)
  }
  console.log('')
  console.log(`Manifest written to: ${manifestPath}`)
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
