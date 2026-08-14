import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.ts'

describe('controller middleware', () => {
  it('runs parent controller middleware for the parent action', async () => {
    let response = await router.fetch('http://localhost/parent')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      route: 'parent',
      trace: [
        'router middleware',
        'parent mount middleware',
        'parent controller middleware',
        'parent action',
      ],
    })
  })

  it('runs child controller middleware for the child action', async () => {
    let response = await router.fetch('http://localhost/parent/child')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      route: 'child',
      trace: [
        'router middleware',
        'parent mount middleware',
        'child controller middleware',
        'child action',
      ],
    })
  })

  it('runs grandchild controller middleware for the grandchild action', async () => {
    let response = await router.fetch('http://localhost/parent/child/grandchild')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      route: 'grandchild',
      trace: [
        'router middleware',
        'parent mount middleware',
        'grandchild controller middleware',
        'grandchild action',
      ],
    })
  })
})
