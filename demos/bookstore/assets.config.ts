import { glob } from 'glob'
import * as fs from 'node:fs/promises'
import type { BuildOptions } from 'remix/assets'

export async function getAssetsBuildConfig() {
  let clientEntries: string[] = []
  for (let file of await glob('app/**/*.{ts,tsx}', { ignore: 'node_modules/**' })) {
    let content = await fs.readFile(file, 'utf-8')
    if (content.includes('clientEntry(') && content.includes('import.meta.url')) {
      clientEntries.push(file)
    }
  }

  return {
    source: {
      scripts: ['app/entry.tsx', ...clientEntries],
    },
    workspaceRoot: '../..',
    outDir: './build/assets',
    baseUrl: '/assets',
    fileNames: '[name]-[hash]',
    manifest: './build/assets-manifest.json',
    minify: true,
    sourcemap: 'external',
  } as const satisfies BuildOptions
}
