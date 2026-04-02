import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateFingerprint } from './fingerprint.ts'

describe('generateFingerprint', () => {
  it('changes when the buildId changes', async () => {
    let fingerprintA = await generateFingerprint({
      buildId: 'build-a',
      content: 'export const value = 1',
    })
    let fingerprintB = await generateFingerprint({
      buildId: 'build-b',
      content: 'export const value = 1',
    })

    assert.notEqual(fingerprintA, fingerprintB)
  })

  it('uses an unambiguous serialization format', async () => {
    let fingerprintA = await generateFingerprint({
      buildId: 'b\0c',
      content: 'a',
    })
    let fingerprintB = await generateFingerprint({
      buildId: 'c',
      content: 'a\0b',
    })

    assert.notEqual(fingerprintA, fingerprintB)
  })
})
