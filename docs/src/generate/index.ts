import fs from 'node:fs/promises'
import path from 'node:path'
import util from 'node:util'
import { getDocumentedAPI } from './documented-api.ts'
import { writeMarkdownFiles } from './markdown.ts'
import { loadTypeDoc } from './typedoc.ts'
import { info } from './utils.ts'

const DOCS_DIR = path.join('build', 'md')
const TYPEDOC_DIR = path.join('build', 'typedoc')

// Ensure we're running from the /docs directory
let cwd = process.cwd()
if (!cwd.endsWith('/docs')) {
  console.error('❌ This script must be run from the /docs directory')
  process.exit(1)
}

let { values: cliArgs } = util.parseArgs({
  options: {
    // Path to a TypeDoc JSON file to use as the input, instead of running Typedoc
    // (mutually exclusive with `entryPoints`)
    input: {
      type: 'string',
      short: 'i',
    },
    // Entrypoints to run typedoc against (mutually exclusive with `input`)
    entryPoints: {
      type: 'string',
      short: 'e',
      default: '../packages/*',
    },
    // Git tag to use for source code links from docs
    tag: {
      type: 'string',
      short: 't',
    },
  },
})

info(`Clearing output directory: ${DOCS_DIR}`)
await fs.rm(DOCS_DIR, { recursive: true, force: true })

// Load the full TypeDoc project and walk it to create a lookup map and
// determine which APIs we want to generate documentation for
let { comments, apisToDocument } = await loadTypeDoc(
  'input' in cliArgs && cliArgs.input
    ? // When input is specified, we're operating off an existing typedoc api.json file
      { input: cliArgs.input }
    : // Otherwise, we run typedoc and write the output to TYPEDOC_DIR
      { entryPoints: cliArgs.entryPoints, typedocDir: TYPEDOC_DIR, tag: cliArgs.tag },
)

// Parse JSDocs into DocumentedAPI instances we can write out to markdown
let documentedAPIs = [...apisToDocument].map((name) => getDocumentedAPI(name, comments.get(name)!))

// Write out docs
await writeMarkdownFiles(documentedAPIs, DOCS_DIR)
info('Documentation generation complete!')
