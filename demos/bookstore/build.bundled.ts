/**
 * Bundled build for the bookstore demo.
 * Uses esbuild to bundle entry points with hashed filenames and a metafile.
 * Outputs to build/assets with locally-scoped manifest (same layout as unbundled build).
 *
 * Usage:
 *   pnpm run build:bundled
 */

import * as esbuild from 'esbuild'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getAssetsBuildConfig } from './assets.config.ts'

function normalizePathForManifest(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '')
}

function toManifestLocalPath(value: string, prefix: string): string {
  let normalizedPath = normalizePathForManifest(value)
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : normalizedPath
}

async function main() {
  let config = await getAssetsBuildConfig()

  await fs.rm(config.outDir, { recursive: true, force: true })
  await fs.mkdir(config.outDir, { recursive: true })

  let esbuildConfig = {
    entryPoints: config.scripts,
    outdir: config.outDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    outbase: 'app',
    entryNames: '[dir]/[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    minify: config.minify,
    sourcemap: config.sourcemap,
  } as const satisfies esbuild.BuildOptions

  console.log('Entry points:')
  for (let entryPoint of esbuildConfig.entryPoints) {
    console.log(`  ${entryPoint}`)
  }
  console.log('')

  let result = await esbuild.build(esbuildConfig)

  // Emit manifest with locally-scoped script paths (relative to outdir) for assets(manifest, { baseUrl })
  let prefix = `${normalizePathForManifest(esbuildConfig.outdir)}/`
  let outputs: Record<string, (typeof result.metafile)['outputs'][string]> = {}
  for (let [outputPath, entry] of Object.entries(result.metafile.outputs)) {
    let localPath = toManifestLocalPath(outputPath, prefix)
    let imports = entry.imports?.map((imp) => ({
      ...imp,
      path: toManifestLocalPath(imp.path, prefix),
    }))
    outputs[localPath] = imports ? { ...entry, imports } : entry
  }
  let manifest = {
    scripts: {
      outputs,
    },
    files: {
      outputs: {},
    },
  }

  let manifestPath = config.manifest
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
