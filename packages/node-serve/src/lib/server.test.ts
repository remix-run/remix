import * as https from 'node:https'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

const describeUws = process.platform === 'win32' ? describe.skip : describe
const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../node-fetch-server/demos/http2',
)

describeUws('serve', () => {
  it('handles fetch requests with the uWebSockets.js transport', async () => {
    let { serve } = await import('../index.ts')
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

  it('uses the host option to override the incoming Host header', async () => {
    let { serve } = await import('../index.ts')
    let server = serve(
      async (request) => {
        assert.equal(request.url, 'http://remix.run/test?value=1')
        return new Response('ok')
      },
      { host: 'remix.run', port: 0 },
    )

    await server.ready

    try {
      let response = await fetch(`http://127.0.0.1:${server.port}/test?value=1`)

      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'ok')
    } finally {
      server.close()
    }
  })

  it('serves HTTPS requests when TLS options are provided', async () => {
    let { serve } = await import('../index.ts')
    let server = serve(
      (request) => {
        assert.equal(request.url, 'https://remix.run/secure?value=1')
        return new Response('secure')
      },
      {
        host: 'remix.run',
        port: 0,
        tls: {
          keyFile: path.join(fixturesDir, 'server.key'),
          certFile: path.join(fixturesDir, 'server.crt'),
        },
      },
    )

    await server.ready

    try {
      let response = await requestHttps(server.port, '/secure?value=1')

      assert.equal(response.statusCode, 200)
      assert.equal(response.body, 'secure')
    } finally {
      server.close()
    }
  })
})

function requestHttps(
  port: number,
  requestPath: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    let request = https.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        rejectUnauthorized: false,
      },
      (response) => {
        let chunks: Buffer[] = []

        response.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })

        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
          })
        })
      },
    )

    request.on('error', reject)
    request.end()
  })
}
