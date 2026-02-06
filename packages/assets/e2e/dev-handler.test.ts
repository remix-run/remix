import * as assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as http from 'node:http'

import { createDevAssetsHandler } from '../src/index.ts'

let server: http.Server
let tmpDir: string
let baseUrl: string

let fixtureFiles: Record<string, string> = {
  'app/entry.ts': `import { greet } from './utils/greet.ts'
import { Counter } from './components/Counter.ts'

export let greetMessage = greet('World')
export { Counter }
`,

  'app/components/Counter.ts': `export function Counter(): string {
  return 'Counter'
}
`,

  'app/utils/greet.ts': `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`,
}

async function createFixture(dir: string) {
  for (let [filePath, content] of Object.entries(fixtureFiles)) {
    let fullPath = path.join(dir, filePath)
    await fsp.mkdir(path.dirname(fullPath), { recursive: true })
    await fsp.writeFile(fullPath, content)
  }
}

function startServer(appDir: string, projectRoot: string): Promise<http.Server> {
  let handler = createDevAssetsHandler({
    root: appDir,
    allow: ['**'],
    workspace: {
      root: projectRoot,
      allow: ['**'],
    },
  })

  let server = http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      res.end()
      return
    }
    let pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    let headers = new Headers()
    for (let [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
    let response = await handler.serve(pathname, headers)
    if (response) {
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
      if (response.body) {
        let buf = await response.arrayBuffer()
        res.end(Buffer.from(buf))
      } else {
        res.end()
      }
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  return new Promise((resolve) => {
    server.listen(0, () => resolve(server))
  })
}

describe('createDevAssetsHandler e2e', () => {
  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'assets-handler-test-'))
    await createFixture(tmpDir)

    let appDir = path.join(tmpDir, 'app')
    server = await startServer(appDir, tmpDir)

    let address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server port')
    }
    let port = (address as { port: number }).port
    baseUrl = `http://localhost:${port}`
  })

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('serves transformed TypeScript with correct content type', async () => {
    let response = await fetch(`${baseUrl}/entry.ts`)
    assert.equal(response.status, 200)

    let contentType = response.headers.get('content-type')
    assert.ok(contentType?.includes('application/javascript'))

    let body = await response.text()
    assert.ok(!body.includes(': string'), 'Expected TypeScript to be transformed')
    assert.ok(body.includes('/utils/greet.ts') || body.includes('greet'), 'Expected imports')
  })

  it('returns 404 for non-existent files', async () => {
    let response = await fetch(`${baseUrl}/does-not-exist.tsx`)
    assert.equal(response.status, 404)
  })

  it('returns ETag and supports 304 when unchanged', async () => {
    let res1 = await fetch(`${baseUrl}/entry.ts`)
    assert.equal(res1.status, 200)
    let etag = res1.headers.get('etag')
    assert.ok(etag, 'Expected ETag header')

    let res2 = await fetch(`${baseUrl}/entry.ts`, {
      headers: { 'If-None-Match': etag! },
    })
    assert.equal(res2.status, 304)
  })
})
