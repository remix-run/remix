import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { spaResponse } from './index.ts'
import { unwrapFrameResolution } from './runtime/frame-resolution.ts'

describe('SPA responses', () => {
  it('associates a Remix node with an otherwise bodyless response', async () => {
    let node = <h1>Hello</h1>
    let response = spaResponse.create(node, {
      status: 201,
      headers: { 'X-Route': 'home' },
    })
    let redirectedTo = 'https://remix.run/hello'

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Route')).toBe('home')
    expect(response.body).toBe(null)
    expect(spaResponse.finalize(response, redirectedTo)).toBe(response)
    expect(await unwrapFrameResolution(response)).toEqual({ content: node, redirectedTo })
  })

  it('rejects responses that were not created by spaResponse.create', () => {
    expect(() => spaResponse.finalize(new Response())).toThrow(
      new TypeError('Expected a Remix SPA response'),
    )
  })
})
