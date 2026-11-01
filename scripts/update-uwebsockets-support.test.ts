import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { writeConsumerSupportChanges } from './update-uwebsockets.ts'

describe('uWebSockets.js consumer support changes', () => {
  it('writes a minor node-serve note and a major Remix note when Node support is removed', async () => {
    let root = await createPackages('0.2.0', '3.0.0')
    try {
      await writeConsumerSupportChanges(root, [115, 127, 137, 141], [127, 137, 141])
      assert.equal(
        await fs.readFile(
          path.join(root, 'packages/node-serve/.changes/minor.node-support.md'),
          'utf8',
        ),
        'BREAKING CHANGE: Supported Node.js versions for `node-serve` are now 22, 24, 25. Support for Node.js 20 has been removed. Upgrade to a supported Node.js version before updating.\n',
      )
      assert.equal(
        await fs.readFile(
          path.join(root, 'packages/remix/.changes/major.node-serve.node-support.md'),
          'utf8',
        ),
        'BREAKING CHANGE: Supported Node.js versions for `remix/node-serve` are now 22, 24, 25. Support for Node.js 20 has been removed. Upgrade to a supported Node.js version before updating.\n',
      )
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('writes minor consumer notes when a new Node version is supported', async () => {
    let root = await createPackages('0.2.0', '3.0.0')
    try {
      await writeConsumerSupportChanges(root, [127, 137, 141], [127, 137, 141, 147])
      assert.equal(
        await fs.readFile(
          path.join(root, 'packages/node-serve/.changes/minor.node-support.md'),
          'utf8',
        ),
        'Supported Node.js versions for `node-serve` are now 22, 24, 25, 26.\n',
      )
      assert.equal(
        await fs.readFile(
          path.join(root, 'packages/remix/.changes/minor.node-serve.node-support.md'),
          'utf8',
        ),
        'Supported Node.js versions for `remix/node-serve` are now 22, 24, 25, 26.\n',
      )
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('uses major notes for both consumers once node-serve is stable', async () => {
    let root = await createPackages('1.0.0', '3.0.0')
    try {
      await writeConsumerSupportChanges(root, [127, 137], [137])
      assert.deepEqual(await fs.readdir(path.join(root, 'packages/node-serve/.changes')), [
        'major.node-support.md',
      ])
      assert.deepEqual(await fs.readdir(path.join(root, 'packages/remix/.changes')), [
        'major.node-serve.node-support.md',
      ])
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('does not create consumer changes when the ABI matrix is unchanged', async () => {
    let root = await createPackages('0.2.0', '3.0.0')
    try {
      await writeConsumerSupportChanges(root, [127, 137], [127, 137])
      await assert.rejects(fs.access(path.join(root, 'packages/node-serve/.changes')), {
        code: 'ENOENT',
      })
      await assert.rejects(fs.access(path.join(root, 'packages/remix/.changes')), {
        code: 'ENOENT',
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

async function createPackages(nodeServeVersion: string, remixVersion: string): Promise<string> {
  let root = await fs.mkdtemp(path.join(os.tmpdir(), 'uws-consumer-support-'))
  await fs.mkdir(path.join(root, 'packages/node-serve'), { recursive: true })
  await fs.mkdir(path.join(root, 'packages/remix'), { recursive: true })
  await fs.writeFile(
    path.join(root, 'packages/node-serve/package.json'),
    JSON.stringify({ version: nodeServeVersion }),
  )
  await fs.writeFile(
    path.join(root, 'packages/remix/package.json'),
    JSON.stringify({ version: remixVersion }),
  )
  return root
}
