import type * as esbuild from 'esbuild'
import { glob } from 'glob'
import * as fs from 'node:fs/promises'

/**
 * Auto-discover client entries by scanning for files that contain both
 * `clientEntry(...)` and `import.meta.url`.
 */
async function discoverClientEntries(): Promise<string[]> {
  let files = await glob('app/**/*.{ts,tsx}', { ignore: 'node_modules/**' })
  let clientEntries: string[] = []

  for (let file of files) {
    let content = await fs.readFile(file, 'utf-8')
    // Simple string matching - good enough for proof of concept
    if (content.includes('clientEntry(') && content.includes('import.meta.url')) {
      clientEntries.push(file)
    }
  }

  return clientEntries
}

/**
 * Create esbuild configuration, auto-discovering client entries in production builds.
 * In development, client entries are omitted since all files are served on-demand.
 */
export async function getEsbuildConfig() {
  let isDev = process.env.NODE_ENV === 'development'

  return {
    entryPoints: ['app/entry.tsx', ...(isDev ? [] : await discoverClientEntries())],
    bundle: true,
    splitting: true,
    format: 'esm',
    outdir: './build',
    outbase: 'app',
    entryNames: '[dir]/[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    minify: true,
    sourcemap: 'external',
  } as const satisfies esbuild.BuildOptions
}
