// Copy `*.demo.tsx` files from `packages/ui/src/components/<comp>/demos/` into
// `docs/build/demos/ui/<comp>/`, rewriting `@remix-run/*` imports to `remix/*`
// (the docs app depends on `remix`, not `@remix-run/ui`). The runtime server
// reads from `docs/build/demos/` — see `src/server/demos.tsx`.

import * as fs from 'node:fs'
import * as path from 'node:path'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const UI_COMPONENTS_DIR = path.join(REPO_DIR, 'packages', 'ui', 'src', 'components')
const DEMO_BUILD_DIR = path.join(DOCS_DIR, 'build', 'demos')

function rewriteImports(source: string): string {
  return source.replace(
    /(from\s+['"]|import\s*\(\s*['"])@remix-run\//g,
    (_match, prefix) => `${prefix}remix/`,
  )
}

function* walkDemoSources(dir: string): Generator<string> {
  for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let absolutePath = path.join(dir, entry.name)
    if (entry.name === 'demos') {
      for (let demoEntry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
        if (demoEntry.isFile() && demoEntry.name.endsWith('.demo.tsx')) {
          yield path.join(absolutePath, demoEntry.name)
        }
      }
      continue
    }
    yield* walkDemoSources(absolutePath)
  }
}

fs.rmSync(DEMO_BUILD_DIR, { recursive: true, force: true })

let count = 0
for (let sourcePath of walkDemoSources(UI_COMPONENTS_DIR)) {
  // packages/ui/src/components/<comp>/demos/<slug>.demo.tsx
  let parts = path.relative(REPO_DIR, sourcePath).split(path.sep)
  if (
    parts.length !== 7 ||
    parts[0] !== 'packages' ||
    parts[1] !== 'ui' ||
    parts[2] !== 'src' ||
    parts[3] !== 'components' ||
    parts[5] !== 'demos' ||
    !parts[6].endsWith('.demo.tsx')
  ) {
    throw new Error(`Invalid demo location: ${sourcePath}`)
  }
  let outPath = path.join(DEMO_BUILD_DIR, 'ui', parts[4], parts[6])
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, rewriteImports(fs.readFileSync(sourcePath, 'utf-8')))
  count++
}

console.log(`build-demos: wrote ${count} files to ${path.relative(DOCS_DIR, DEMO_BUILD_DIR)}`)
