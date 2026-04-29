import assert from 'node:assert/strict'
import { test } from 'node:test'

import { serve } from '../uws.ts'

test('serve handles fetch requests with the uWebSockets.js transport', async () => {
  let server = serve(
    async (request) => {
      assert.equal(request.method, 'POST')
      assert.equal(request.headers.get('content-type'), 'text/plain')
      assert.equal(await request.text(), 'hello')

      return new Response('ok', {
        status: 201,
        headers: {
          'Content-Type': 'text/plain',
          'X-Test': 'yes',
        },
      })
    },
    { port: 0 },
  )

  await server.ready

  try {
    let response = await fetch(`http://127.0.0.1:${server.port}/test?value=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'hello',
    })

    assert.equal(response.status, 201)
    assert.equal(response.headers.get('x-test'), 'yes')
    assert.equal(await response.text(), 'ok')
  } finally {
    server.close()
  }
})
