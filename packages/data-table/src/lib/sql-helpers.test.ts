import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { compileOrderByDirection, normalizeCountRows } from './sql-helpers.ts'

describe('SQL helpers', () => {
  it('compiles order by directions case-insensitively', () => {
    assert.equal(compileOrderByDirection('asc'), 'ASC')
    assert.equal(compileOrderByDirection('ASC'), 'ASC')
    assert.equal(compileOrderByDirection('Asc'), 'ASC')
    assert.equal(compileOrderByDirection('desc'), 'DESC')
    assert.equal(compileOrderByDirection('DESC'), 'DESC')
    assert.equal(compileOrderByDirection('Desc'), 'DESC')
  })

  it('rejects invalid order by directions', () => {
    assert.throws(
      () => compileOrderByDirection('ascending'),
      /Invalid order by direction: expected "asc" or "desc"/,
    )
  })

  it('normalizes numeric string and bigint counts', () => {
    assert.deepEqual(normalizeCountRows([{ count: '2' }, { count: 5n }, { count: 'oops' }, {}]), [
      { count: 2 },
      { count: 5 },
      { count: 'oops' },
      {},
    ])
  })
})
