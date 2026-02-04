import type * as esbuild from 'esbuild'

export const esbuildConfig = {
  entryPoints: [
    'app/assets/entry.tsx',
    'app/assets/cart-button.tsx',
    'app/assets/image-carousel.tsx',
  ],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: './build',
  outbase: 'app/assets',
  entryNames: '[dir]/[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
  minify: true,
} as const satisfies esbuild.BuildOptions
