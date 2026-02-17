import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'

import { methodOverride } from './method-override.ts'

describe('methodOverride middleware', () => {
  it('overrides the request method with the value of the method override field', async () => {
    let router = createRouter({
      middleware: [formData(), methodOverride()],
    })

    router.post('/', () => new Response('Created'))
    router.delete('/', () => new Response('Deleted'))

    let response = await router.fetch('https://remix.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '_method=DELETE',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Deleted')
  })
})
