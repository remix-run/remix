import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { shouldLoadPagefind } from './should-load-pagefind.ts'

describe('shouldLoadPagefind()', () => {
  it('loads Pagefind outside development before its generated module exists', () => {
    assert.equal(shouldLoadPagefind(`${import.meta.filename}.missing`, 'production'), true)
  })

  it('omits Pagefind in development when its generated module is missing', () => {
    assert.equal(shouldLoadPagefind(`${import.meta.filename}.missing`, 'development'), false)
  })
})
