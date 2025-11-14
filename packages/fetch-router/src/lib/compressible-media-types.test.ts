import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'

import { generateCompressibleMediaTypesContent } from '../../scripts/generate-compressible.js'

describe('compressible-media-types', () => {
  it('is up to date with mime-db and has not been modified manually', () => {
    let __dirname = dirname(fileURLToPath(import.meta.url))
    let generatedPath = join(__dirname, 'compressible-media-types.ts')

    let expectedContent = generateCompressibleMediaTypesContent()
    let actualContent = readFileSync(generatedPath, 'utf-8')

    assert.equal(
      actualContent,
      expectedContent,
      'compressible-media-types.ts does not match expected output. Run `pnpm --filter @remix-run/fetch-router run generate:compressible` to update it.',
    )
  })
})
