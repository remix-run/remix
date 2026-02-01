import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'

import { generateCompressibleMimeTypesContent, generateMimeTypesContent } from './codegen.ts'

describe('generated files', () => {
  // Normalize line endings for cross-platform compatibility
  let normalizeLineEndings = (str: string) => str.replace(/\r\n/g, '\n')

  it('compressible-mime-types.ts is up to date with mime-db and has not been modified manually', () => {
    let __dirname = dirname(fileURLToPath(import.meta.url))
    let generatedPath = join(__dirname, '../src/generated/compressible-mime-types.ts')

    let expectedContent = generateCompressibleMimeTypesContent()
    let actualContent = readFileSync(generatedPath, 'utf-8')

    assert.equal(
      normalizeLineEndings(actualContent),
      normalizeLineEndings(expectedContent),
      'compressible-mime-types.ts does not match expected output. Run `pnpm codegen` to update it.',
    )
  })

  it('mime-types.ts is up to date with mime-db and has not been modified manually', () => {
    let __dirname = dirname(fileURLToPath(import.meta.url))
    let generatedPath = join(__dirname, '../src/generated/mime-types.ts')

    let expectedContent = generateMimeTypesContent()
    let actualContent = readFileSync(generatedPath, 'utf-8')

    assert.equal(
      normalizeLineEndings(actualContent),
      normalizeLineEndings(expectedContent),
      'mime-types.ts does not match expected output. Run `pnpm codegen` to update it.',
    )
  })
})
