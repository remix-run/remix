/**
 * Bundled build for the bookstore demo.
 * Uses esbuild to bundle entry points with hashed filenames and a metafile.
 * Outputs to build/assets with locally-scoped manifest (same layout as unbundled build).
 *
 * Usage:
 *   pnpm run build:bundled
 */

import * as esbuild from 'esbuild'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { glob } from 'glob'
import sharp from 'sharp'
import { getEsbuildConfig } from './esbuild.config.ts'

let outdir = './build/assets'

async function buildFileOutputs(): Promise<Record<string, { path: string }>> {
  let outputs: Record<string, { path: string }> = {}
  let sourcePaths = await glob('app/images/books/**/*.png')

  await Promise.all(
    sourcePaths.map(async (sourcePath) => {
      let sourceData = await fs.readFile(sourcePath)
      let jpgData = await sharp(sourceData).jpeg({ quality: 72, mozjpeg: true }).toBuffer()
      let hash = createHash('sha256')
        .update(sourcePath)
        .update('\0')
        .update(jpgData)
        .digest('hex')
        .slice(0, 8)
      let parsed = path.parse(sourcePath)
      let outPath = `${parsed.dir.replace(/\\/g, '/')}/${parsed.name}-${hash}.jpg`
      let fullOutPath = path.join(outdir, outPath)
      await fs.mkdir(path.dirname(fullOutPath), { recursive: true })
      await fs.writeFile(fullOutPath, jpgData)
      outputs[sourcePath] = { path: outPath }
    }),
  )

  return outputs
}

async function main() {
  await fs.rm(outdir, { recursive: true, force: true })
  await fs.mkdir(outdir, { recursive: true })

  let config = await getEsbuildConfig()

  console.log('Entry points:')
  for (let entryPoint of config.entryPoints!) {
    console.log(`  ${entryPoint}`)
  }
  console.log('')

  let result = await esbuild.build({ ...config, outdir })
  let fileOutputs = await buildFileOutputs()

  // Emit manifest with locally-scoped script paths (relative to outdir) for assets(manifest, { baseUrl })
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
  let manifest = {
    scripts: {
      outputs,
    },
    files: {
      outputs: fileOutputs,
    },
  }

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
