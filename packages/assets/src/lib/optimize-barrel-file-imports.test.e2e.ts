import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'

import { createAssetServer } from './asset-server.ts'

async function write(dir: string, relativePath: string, content: string): Promise<void> {
  let filePath = path.join(dir, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

async function createTestServer(rootDir: string): Promise<{
  baseUrl: string
  close(): Promise<void>
}> {
  let assetServer = createAssetServer({
    allowFiles: ['app/**'],
    basePath: '/assets',
    optimizeBarrelFileImports: true,
    rootDir,
    watch: false,
  })
  let server = http.createServer(async (request, response) => {
    try {
      let url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname === '/') {
        response.setHeader('Content-Type', 'text/html')
        response.end('<script type="module" src="/assets/app/entry.ts"></script>')
        return
      }

      let assetResponse = await assetServer.fetch(new Request(url))
      if (!assetResponse) {
        response.statusCode = 404
        response.end('Not found')
        return
      }
      response.statusCode = assetResponse.status
      assetResponse.headers.forEach((value, name) => response.setHeader(name, value))
      response.end(Buffer.from(await assetResponse.arrayBuffer()))
    } catch (error) {
      response.statusCode = 500
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise<void>((resolve, reject) => {
    let onError = (error: Error) => reject(error)
    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError)
      resolve()
    })
  })

  let address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP server address')

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await assetServer.close()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

describe('optimizeBarrelFileImports', () => {
  it('preserves evaluation order when repeated imports expand through nested re-exports', async (t) => {
    let dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reexport-order-test-'))
    await write(dir, 'package.json', JSON.stringify({ sideEffects: false }))
    await write(
      dir,
      'app/entry.ts',
      [
        'import "./before.ts"',
        'import { second as localSecond } from "./outer.ts"',
        'import "./between.ts"',
        'import { first as localFirst, third as localThird } from "./outer.ts"',
        'import "./after.ts"',
        'globalThis.result = { values: [localFirst, localSecond, localThird], order: globalThis.order }',
      ].join('\n'),
    )
    await write(
      dir,
      'app/outer.ts',
      [
        'export { nestedFirst as first, nestedThird as third } from "./first-barrel.ts"',
        'export { nestedSecond as second } from "./second-barrel.ts"',
      ].join('\n'),
    )
    await write(
      dir,
      'app/first-barrel.ts',
      [
        'import { rawFirst as localFirst, rawThird as localThird } from "./values.ts"',
        'export { localFirst as nestedFirst, localThird as nestedThird }',
      ].join('\n'),
    )
    await write(
      dir,
      'app/second-barrel.ts',
      'export { rawSecond as nestedSecond } from "./second.ts"',
    )
    await write(dir, 'app/before.ts', 'globalThis.order = ["before"]')
    await write(
      dir,
      'app/values.ts',
      'globalThis.order.push("values")\nexport const rawFirst = 1\nexport const rawThird = 3',
    )
    await write(dir, 'app/second.ts', 'globalThis.order.push("second")\nexport const rawSecond = 2')
    await write(dir, 'app/between.ts', 'globalThis.order.push("between")')
    await write(dir, 'app/after.ts', 'globalThis.order.push("after")')

    let page = await t.serve(await createTestServer(dir))
    t.after(() => fs.rm(dir, { recursive: true, force: true }))
    await page.goto('/')
    await page.waitForFunction(() => 'result' in globalThis)

    let result: unknown = await page.evaluate(() => Reflect.get(globalThis, 'result'))
    assert.deepEqual(result, {
      order: ['before', 'values', 'second', 'between', 'after'],
      values: [1, 2, 3],
    })
  })

  it('preserves retained dependency order across removed branches', async (t) => {
    let dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reexport-order-test-'))
    await write(
      dir,
      'package.json',
      JSON.stringify({ sideEffects: ['./app/shared.ts', './app/other.ts'] }),
    )
    await write(
      dir,
      'app/entry.ts',
      [
        'import { value } from "./barrel.ts"',
        'globalThis.result = { value, order: globalThis.order }',
      ].join('\n'),
    )
    await write(
      dir,
      'app/barrel.ts',
      ['export { unused } from "./unused.ts"', 'export { value } from "./value.ts"'].join('\n'),
    )
    await write(dir, 'app/unused.ts', 'import "./shared.ts"\nexport const unused = "unused"')
    await write(
      dir,
      'app/value.ts',
      ['import "./other.ts"', 'import "./shared.ts"', 'export const value = "value"'].join('\n'),
    )
    await write(dir, 'app/shared.ts', 'globalThis.order = ["shared"]')
    await write(dir, 'app/other.ts', 'globalThis.order.push("other")')

    let page = await t.serve(await createTestServer(dir))
    t.after(() => fs.rm(dir, { recursive: true, force: true }))
    await page.goto('/')
    await page.waitForFunction(() => 'result' in globalThis)

    let result: unknown = await page.evaluate(() => Reflect.get(globalThis, 'result'))
    assert.deepEqual(result, { order: ['shared', 'other'], value: 'value' })
  })
})
