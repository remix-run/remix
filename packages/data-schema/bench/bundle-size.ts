import * as path from 'node:path'
import { gzipSync } from 'node:zlib'

import { build } from 'esbuild'

// Entries import from the built distribution, like an installed package, and only what they use,
// so each bundle shows what tree shaking keeps.
const distDirectory = path.join(import.meta.dirname, '..', 'dist')

const entries = [
  {
    contents: `
      import { string } from './index.js'
      export let schema = string()
    `,
    name: 'string()',
  },
  {
    contents: `
      import { number } from './index.js'
      export let schema = number()
    `,
    name: 'number()',
  },
  {
    contents: `
      import { minLength } from './checks.js'
      import { string } from './index.js'
      export let schema = string().pipe(minLength(1))
    `,
    name: 'string().pipe(minLength(1))',
  },
  {
    contents: `
      import { array, number, object, optional, string } from './index.js'
      export let schema = object({
        name: string(),
        owner: optional(object({ age: number() })),
        tags: array(string()),
      })
    `,
    name: 'Nested object() with array() and optional()',
  },
  {
    contents: `
      import { array, number, object, optional, parseSafe, string } from './index.js'
      let schema = object({
        name: string(),
        owner: optional(object({ age: number() })),
        tags: array(string()),
      })
      export let parsePet = (value) => parseSafe(schema, value)
    `,
    name: 'Same, plus parseSafe()',
  },
  {
    contents: `
      import { array, object, string } from './index.js'
      import { lazy } from './lazy.js'
      export let schema = object({
        children: array(lazy(() => schema)),
        name: string(),
      })
    `,
    name: 'Recursive lazy()',
  },
  {
    contents: `
      import { number } from './coerce.js'
      export let schema = number()
    `,
    name: 'number() from /coerce',
  },
  {
    contents: `
      import { field, object } from './form-data.js'
      import { string } from './index.js'
      export let schema = object({ name: field(string()) })
    `,
    name: 'Form-data object() with field()',
  },
  {
    contents: `
      import * as s from './index.js'
      export { s }
    `,
    name: 'import * as s',
  },
]

async function measure(contents: string): Promise<{ gzip: number; minified: number }> {
  let result = await build({
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    minify: true,
    platform: 'neutral',
    stdin: { contents, loader: 'js', resolveDir: distDirectory },
    write: false,
  })
  let output = result.outputFiles[0]
  if (output === undefined) {
    throw new Error('esbuild produced no output')
  }

  return { gzip: gzipSync(output.contents).byteLength, minified: output.contents.byteLength }
}

async function main(): Promise<void> {
  let table: Record<string, Record<string, number>> = {}
  for (let entry of entries) {
    let { gzip, minified } = await measure(entry.contents)
    table[entry.name] = { 'gzip (B)': gzip, 'minified (B)': minified }
  }

  console.log('Named-import bundle size (esbuild, minified)')
  console.table(table)
}

await main()
