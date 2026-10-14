import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { writeResult } from './utils.ts'

describe('writeResult()', () => {
  it('rewrites TypeScript extensions in dynamic imports', async () => {
    let outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-prerender-'))

    try {
      let response = new Response(
        `export let quoted = import('./quoted.ts')
export let template = import(\`./template.ts\`)
`,
        { headers: { 'Content-Type': 'application/javascript' } },
      )

      await writeResult(outputDir, '/entry.ts', '/entry.ts', response)

      assert.equal(
        await fs.readFile(path.join(outputDir, 'entry.js'), 'utf8'),
        `export let quoted = import('./quoted.js')
export let template = import(\`./template.js\`)
`,
      )
    } finally {
      await fs.rm(outputDir, { recursive: true, force: true })
    }
  })
})
