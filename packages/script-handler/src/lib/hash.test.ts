import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hashContent } from './hash.ts'

describe('hashContent', () => {
  it('returns a string of exactly 16 characters', async () => {
    let hash = await hashContent('hello world')
    assert.equal(typeof hash, 'string')
    assert.equal(hash.length, 16)
  })

  it('produces base-36 characters only (0-9 and a-z)', async () => {
    let hash = await hashContent('some content')
    assert.match(hash, /^[0-9a-z]{16}$/)
  })

  it('is deterministic — same input produces same output', async () => {
    let content = 'export function foo() { return 42 }'
    let hash1 = await hashContent(content)
    let hash2 = await hashContent(content)
    assert.equal(hash1, hash2)
  })

  it('produces different hashes for different inputs', async () => {
    let hash1 = await hashContent('export const a = 1')
    let hash2 = await hashContent('export const b = 1')
    assert.notEqual(hash1, hash2)
  })

  it('is sensitive to whitespace differences', async () => {
    let hash1 = await hashContent('export const x = 1')
    let hash2 = await hashContent('export const x = 1 ')
    assert.notEqual(hash1, hash2)
  })

  it('handles empty string', async () => {
    let hash = await hashContent('')
    assert.equal(hash.length, 16)
    assert.match(hash, /^[0-9a-z]{16}$/)
  })

  it('handles unicode content', async () => {
    let hash = await hashContent('export const greeting = "こんにちは"')
    assert.equal(hash.length, 16)
    assert.match(hash, /^[0-9a-z]{16}$/)
  })

  it('handles large content', async () => {
    let large = 'x'.repeat(100_000)
    let hash = await hashContent(large)
    assert.equal(hash.length, 16)
  })

  it('produces collision-resistant hashes across many inputs', async () => {
    let hashes = await Promise.all(
      Array.from({ length: 100 }, (_, i) => hashContent(`module_${i}`)),
    )
    let unique = new Set(hashes)
    assert.equal(unique.size, 100)
  })
})
