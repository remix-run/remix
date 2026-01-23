/**
 * Build script for the assets-spike demo.
 *
 * Bundles the entry point with esbuild, outputting hashed filenames
 * and a metafile for use with @remix-run/assets-middleware.
 *
 * Usage:
 *   pnpm run build
 */

import * as esbuild from 'esbuild'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

let outdir = './build'

async function build() {
  // Clean the build directory
  await fs.rm(outdir, { recursive: true, force: true })
  await fs.mkdir(outdir, { recursive: true })

  // Bundle with esbuild
  let result = await esbuild.build({
    entryPoints: ['app/entry.tsx'],
    bundle: true,
    splitting: true,
    format: 'esm',
    outdir,
    // Use content hash in filenames for cache busting
    entryNames: '[name]-[hash]',
    chunkNames: 'chunk-[hash]',
    // Generate metafile for asset resolution
    metafile: true,
    // Production optimizations
    minify: true,
    sourcemap: true,
    target: 'es2022',
    // JSX configuration
    jsx: 'automatic',
    jsxImportSource: '@remix-run/component',
  })

  // Write the metafile for use by assets-middleware
  let metafilePath = path.join(outdir, 'metafile.json')
  await fs.writeFile(metafilePath, JSON.stringify(result.metafile, null, 2))

  // Log the outputs
  console.log('Build complete!')
  console.log('')
  console.log('Outputs:')
  for (let output of Object.keys(result.metafile.outputs)) {
    console.log(`  ${output}`)
  }
  console.log('')
  console.log(`Metafile written to: ${metafilePath}`)
}

build().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
