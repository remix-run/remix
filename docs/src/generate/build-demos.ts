// Copy package demo source files into `docs/build/demos/`, rewriting
// `@remix-run/*` imports to `remix/*` (the docs app depends on `remix`). The
// runtime server reads from `docs/build/demos/` — see `src/server/demos.tsx`.

import * as fs from 'node:fs'
import * as path from 'node:path'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const DEMO_BUILD_DIR = path.join(DOCS_DIR, 'build', 'demos')
const DEMO_SOURCES = [
  {
    packageName: 'ui',
    sourceDir: path.join(REPO_DIR, 'packages', 'ui', 'src'),
  },
]

function rewriteImports(source: string): string {
  return source.replace(
    /(from\s+['"]|import\s*\(\s*['"])@remix-run\//g,
    (_match, prefix) => `${prefix}remix/`,
  )
}

function isDemoSourceFile(filename: string) {
  return (filename.endsWith('.ts') || filename.endsWith('.tsx')) && !filename.endsWith('.test.ts')
}

function* walkDemoDirectory(dir: string): Generator<string> {
  for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
    let absolutePath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      yield* walkDemoDirectory(absolutePath)
      continue
    }

    if (entry.isFile() && isDemoSourceFile(entry.name)) {
      yield absolutePath
    }
  }
}

function* walkDemoSources(dir: string): Generator<string> {
  for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
    let absolutePath = path.join(dir, entry.name)

    if (entry.isFile()) {
      if (entry.name.endsWith('.demo.tsx')) {
        yield absolutePath
      }
      continue
    }

    if (!entry.isDirectory()) continue

    if (entry.name === 'demos' || entry.name === 'shared') {
      yield* walkDemoDirectory(absolutePath)
      continue
    }

    yield* walkDemoSources(absolutePath)
  }
}

fs.rmSync(DEMO_BUILD_DIR, { recursive: true, force: true })

let count = 0
for (let source of DEMO_SOURCES) {
  for (let sourcePath of walkDemoSources(source.sourceDir)) {
    let relativePath = path.relative(source.sourceDir, sourcePath)
    let outPath = path.join(DEMO_BUILD_DIR, source.packageName, relativePath)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, rewriteImports(fs.readFileSync(sourcePath, 'utf-8')))
    count++
  }
}

console.log(`build-demos: wrote ${count} files to ${path.relative(DOCS_DIR, DEMO_BUILD_DIR)}`)
