import type * as esbuild from 'esbuild'

export const esbuildConfig = {
  entryPoints: ['app/entry.tsx'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: './build',
  entryNames: '[name]-[hash]',
  chunkNames: 'chunk-[hash]',
  metafile: true,
  minify: true,
} as const satisfies esbuild.BuildOptions
