import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  packages: 'external',
  outdir: 'dist',
  chunkNames: 'lib/[name]',
  sourcemap: true,
  sourcesContent: false,
})
