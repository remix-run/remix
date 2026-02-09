import type * as esbuild from 'esbuild'
import { glob } from 'glob'
import * as fs from 'node:fs/promises'

/**
 * Auto-discover hydration roots by scanning for files that contain both
 * `hydrationRoot` and `import.meta.url`.
 *
 * This is a simple proof-of-concept using string matching. A production
 * implementation would use proper AST parsing.
 */
async function discoverHydrationRoots(): Promise<string[]> {
  let files = await glob('app/**/*.{ts,tsx}', { ignore: 'node_modules/**' })
  let hydrationRoots: string[] = []

  for (let file of files) {
    let content = await fs.readFile(file, 'utf-8')
    // Simple string matching - good enough for proof of concept
    if (content.includes('hydrationRoot') && content.includes('import.meta.url')) {
      hydrationRoots.push(file)
    }
  }

  return hydrationRoots
}

/**
 * Create esbuild configuration, auto-discovering hydration roots in production builds.
 * In development, hydration roots are omitted since all files are served on-demand.
 */
export async function getEsbuildConfig() {
  let isDev = process.env.NODE_ENV === 'development'

  return {
    entryPoints: ['app/entry.tsx', ...(isDev ? [] : await discoverHydrationRoots())],
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
