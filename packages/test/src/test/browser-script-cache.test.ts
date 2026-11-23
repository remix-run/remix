import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { startServer } from '../app/server.ts'
import { getBrowserTestRootDir } from '../lib/config.ts'
import type { TestContext } from '../lib/context.ts'
import { describe, it } from '../lib/framework.ts'

describe('browser test script serving', () => {
  it('refreshes a cached script after an in-place edit of the same size', async (t) => {
    let { file, url } = await createFixture(t)
    let time = new Date(0)
    await fsp.utimes(file, time, time)
    assert.match(await fetchScript(url), /"original"/)
    await fsp.writeFile(file, 'export const value: string = "modified"')
    assert.match(await fetchScript(url), /"modified"/)
  })

  it('refreshes a cached script after a same-size replacement with the original mtime', async (t) => {
    let { file, url } = await createFixture(t)
    let time = new Date(0)
    await fsp.utimes(file, time, time)
    assert.match(await fetchScript(url), /"original"/)

    let replacement = path.join(path.dirname(file), 'replacement.ts')
    await fsp.writeFile(replacement, 'export const value: string = "replaced"')
    await fsp.utimes(replacement, time, time)
    await fsp.rename(replacement, file)
    assert.match(await fetchScript(url), /"replaced"/)
  })
})

async function createFixture(t: TestContext) {
  let root = getBrowserTestRootDir()
  let parent = path.join(root, '.tmp')
  await fsp.mkdir(parent, { recursive: true })
  let dir = await fsp.mkdtemp(path.join(parent, 'browser-script-cache-'))
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))

  let file = path.join(dir, 'script.ts')
  await fsp.writeFile(file, 'export const value: string = "original"')
  let { server, baseUrl } = await startServer([])
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  )

  let url = new URL('/scripts/' + path.relative(root, file).split(path.sep).join('/'), baseUrl)
  return { file, url }
}

async function fetchScript(url: URL) {
  let response = await fetch(url)
  assert.equal(response.status, 200)
  return response.text()
}
