/**
 * Bundled build for the assets demo.
 * Uses @remix-run/assets for file assets and esbuild for JS bundles.
 * Outputs to build/assets with locally-scoped manifest.
 *
 * Usage:
 *   pnpm run build:bundled
 */

import * as esbuild from 'esbuild'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { build, codegenBuild, substituteAssetPlaceholders } from '@remix-run/assets'
import { buildConfig } from './assets.ts'

function normalizePathForManifest(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '')
}

function toManifestLocalPath(value: string, prefix: string): string {
  let normalizedPath = normalizePathForManifest(value)
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : normalizedPath
}

async function main() {
  // Phase 1: Build file assets (images, etc.) using @remix-run/assets.
  // No scripts here — esbuild handles JS bundling below.
  let filesManifestPath = './build/assets-manifest-files.json'
  await build({
    source: { files: buildConfig.source.files },
    workspaceRoot: buildConfig.workspaceRoot,
    outDir: buildConfig.outDir,
    baseUrl: buildConfig.baseUrl,
    manifest: filesManifestPath,
  })
  let filesManifest = JSON.parse(await fs.readFile(filesManifestPath, 'utf-8'))
  await fs.unlink(filesManifestPath)

  // Phase 2: Bundle scripts with esbuild.
  let esbuildConfig = {
    entryPoints: [...buildConfig.source.scripts],
    outdir: buildConfig.outDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    entryNames: buildConfig.fileNames,
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    minify: buildConfig.minify,
    sourcemap: buildConfig.sourcemap,
    conditions: ['placeholder'],
    write: true,
  } as const satisfies esbuild.BuildOptions

  console.log('Entry points:')
  for (let entryPoint of buildConfig.source.scripts) {
    console.log(`  ${entryPoint}`)
  }
  console.log('')

  let result = await esbuild.build(esbuildConfig)
  let metafile = result.metafile!

  // Build the combined manifest: file outputs from Phase 1, script outputs from Phase 2.
  let prefix = `${normalizePathForManifest(esbuildConfig.outdir)}/`
  let scriptOutputs: Record<string, (typeof metafile)['outputs'][string]> = {}
  for (let [outputPath, entry] of Object.entries(metafile.outputs)) {
    let localPath = toManifestLocalPath(outputPath, prefix)
    let imports = entry.imports?.map((imp) => ({
      ...imp,
      path: toManifestLocalPath(imp.path, prefix),
    }))
    scriptOutputs[localPath] = imports ? { ...entry, imports } : entry
  }

  let manifest = {
    scripts: { outputs: scriptOutputs },
    files: { outputs: filesManifest.files.outputs },
  }

  let manifestPath = buildConfig.manifest
  await fs.mkdir(path.dirname(manifestPath), { recursive: true })
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  // Phase 3: Substitute /__@assets/ placeholder strings with real hashed URLs and cascade.
  await substituteAssetPlaceholders({
    manifest,
    baseUrl: buildConfig.baseUrl,
    outDir: buildConfig.outDir,
  })

  // Phase 4: Generate script .build.ts files from the combined manifest.
  await codegenBuild({ manifest, baseUrl: buildConfig.baseUrl })

  console.log('Build complete!')
  console.log('')
  console.log('Outputs:')
  for (let output of Object.keys(metafile.outputs)) {
    console.log(`  ${output}`)
  }
  console.log('')
  console.log(`Manifest written to: ${manifestPath}`)
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
