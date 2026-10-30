import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getNonceManager, resetNonceManager } from './nonce.ts'

describe('document CSP mode', () => {
  it('cannot enable report-only nonce translation after startup', (t) => {
    resetNonceManager()
    t.after(resetNonceManager)

    getNonceManager()
    expect(getNonceManager(true).reportOnlyCsp).toBe(false)
  })

  it('retains report-only mode for later frames and runtimes in the same document', (t) => {
    resetNonceManager()
    t.after(resetNonceManager)

    getNonceManager(true)
    expect(getNonceManager().reportOnlyCsp).toBe(true)
    expect(getNonceManager(false).reportOnlyCsp).toBe(true)
  })
})
