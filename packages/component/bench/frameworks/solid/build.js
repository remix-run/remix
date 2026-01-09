import { build, context } from 'esbuild'
import { solidPlugin } from 'esbuild-plugin-solid'

let isProduction = process.env.NODE_ENV === 'production'
let isWatch = process.argv.includes('--watch')

let buildOptions = {
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: 'dist/index.js',
  format: 'esm',
  plugins: [solidPlugin()],
  minify: isProduction,
}

if (isWatch) {
  let ctx = await context(buildOptions)
  await ctx.watch()
  console.log('Watching...')
} else {
  await build(buildOptions)
  console.log('Build complete')
}
