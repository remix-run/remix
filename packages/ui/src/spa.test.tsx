import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { nodeFromSpaResponse, spaResponse } from './spa.ts'

describe('SPA responses', () => {
  it('associates a Remix node with an otherwise bodyless response', () => {
    let node = <h1>Hello</h1>
    let response = spaResponse(node, {
      status: 201,
      headers: { 'X-Route': 'home' },
    })

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Route')).toBe('home')
    expect(response.body).toBe(null)
    expect(nodeFromSpaResponse(response)).toBe(node)
  })

  it('rejects responses that were not created by spaResponse', () => {
    expect(() => nodeFromSpaResponse(new Response())).toThrow(
      new TypeError('Expected a Remix SPA response'),
    )
  })
})
