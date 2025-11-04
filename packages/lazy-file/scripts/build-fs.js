import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/fs.ts'],
  outfile: 'dist/fs.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  plugins: [
    {
      name: 'externalize-lazy-file',
      setup(build) {
        build.onResolve({ filter: /^\.\/lib\/lazy-file\.ts$/ }, (args) => {
          return {
            path: args.path.replace(/\.ts$/, '.js'),
            external: true,
          }
        })
      },
    },
  ],
})
