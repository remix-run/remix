import { rm, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { transform } from 'esbuild'
import { rollup } from 'rollup'

const outputDir = path.join(process.argv[2] ?? 'dist', 'browser')
const entries: Record<string, string> = { server: 'src/server.ts', test: 'src/test.ts' }
const modules = new Map<string, string>()
const facades = new Map<string, string>()

// Give each public value an entry so the asset server can follow a named import directly.
// Build them together so JSX, the renderer, and the test and refresh helpers share state.
for (let name of ['index', 'jsx-runtime', 'dev/refresh']) {
  let source = path.resolve('src', name + '.ts')
  let exports = Object.keys(await import(pathToFileURL(source).href))
  let lines: string[] = []
  for (let key of exports) {
    let entry = name + '-' + key
    let id = '\0' + entry
    entries[entry] = id
    modules.set(id, `export { ${key} } from ${JSON.stringify(source)}`)
    lines.push(`export { ${key} } from './${path.basename(entry)}.js'`)
  }
  facades.set(name + '.js', lines.join('\n') + '\n')
}

const bundle = await rollup({
  input: entries,
  treeshake: { moduleSideEffects: false },
  plugins: [
    {
      name: 'component-browser-entries',
      resolveId(id) {
        if (modules.has(id)) return id
      },
      load(id) {
        return modules.get(id)
      },
      async transform(source, id) {
        if (!id.endsWith('.ts')) return
        let { code, map } = await transform(source, {
          loader: 'ts',
          target: 'es2022',
          sourcefile: id,
          sourcemap: true,
        })
        return { code, map }
      },
    },
  ],
})
try {
  await rm(outputDir, { recursive: true, force: true })
  await bundle.write({
    dir: outputDir,
    format: 'es',
    chunkFileNames: 'shared/[name].js',
    hoistTransitiveImports: false,
    sourcemap: true,
    sourcemapExcludeSources: true,
  })
  for (let [name, contents] of facades) {
    await writeFile(path.join(outputDir, name), contents)
  }
} finally {
  await bundle.close()
}
