import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { installNodeHmrRuntime } from './runtime.ts'
import { serverHmrEvents } from './events.ts'

describe('installNodeHmrRuntime', () => {
  it('installs an HMR event channel for the process runtime', () => {
    let runtime = installNodeHmrRuntime({ browserEventUrl: 'http://127.0.0.1:1234/hmr' })

    assert.equal(runtime.browserEventChannel?.url, 'http://127.0.0.1:1234/hmr')
  })

  it('preserves data for repeated hot contexts with the same URL', () => {
    let runtime = installNodeHmrRuntime()
    let first = runtime.createHotContext('file:///app/server.ts')

    first.data.count = 1

    let second = runtime.createHotContext('file:///app/server.ts')

    assert.equal(second.data.count, 1)
  })

  it('runs dispose callbacks with persistent data', async () => {
    let runtime = installNodeHmrRuntime()
    let context = runtime.createHotContext('file:///app/dispose.ts')
    let disposed = false

    context.data.value = 'hello'
    context.dispose((data) => {
      disposed = data.value === 'hello'
    })

    await runtime.disposeAll()

    assert.equal(disposed, true)
  })

  it('awaits dispose callbacks before accept callbacks during updates', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'node-hmr-runtime-test-'))
    try {
      let modulePath = path.join(tmpDir, 'server-module.mjs')
      await fs.writeFile(modulePath, 'export const value = 1\n')
      let moduleUrl = pathToFileURL(modulePath).href
      let runtime = installNodeHmrRuntime()
      let events: string[] = []
      let context = runtime.createHotContext(moduleUrl)

      context.dispose(async () => {
        await Promise.resolve()
        events.push('dispose')
      })
      context.accept(async () => {
        events.push('accept')
      })

      await runtime.update(moduleUrl, 123)

      assert.deepEqual(events, ['dispose', 'accept'])
    } finally {
      await fs.rm(tmpDir, { force: true, recursive: true })
    }
  })

  it('emits server update events after successful hot updates', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'node-hmr-runtime-test-'))
    let unsubscribe: (() => void) | undefined
    try {
      let modulePath = path.join(tmpDir, 'server-module.mjs')
      await fs.writeFile(modulePath, 'export const value = 1\n')
      let moduleUrl = pathToFileURL(modulePath).href
      let runtime = installNodeHmrRuntime()
      let eventPromise = new Promise<unknown>((resolve) => {
        unsubscribe = serverHmrEvents.subscribe(resolve)
      })

      runtime.createHotContext(moduleUrl).accept()
      await runtime.update(moduleUrl, 123)

      assert.deepEqual(await eventPromise, {
        filePath: modulePath,
        timestamp: 123,
        type: 'update',
        url: moduleUrl,
      })
    } finally {
      unsubscribe?.()
      await fs.rm(tmpDir, { force: true, recursive: true })
    }
  })

  it('emits server restart events when a hot context invalidates', async () => {
    let runtime = installNodeHmrRuntime()
    let originalSend = process.send
    let eventPromise = new Promise<unknown>((resolve) => {
      let unsubscribe = serverHmrEvents.subscribe((event) => {
        unsubscribe()
        resolve(event)
      })
    })
    let context = runtime.createHotContext('file:///app/server.ts')

    try {
      process.send = (() => true) as typeof process.send
      context.invalidate('server graph restart')
    } finally {
      process.send = originalSend
    }

    let event = await eventPromise
    assert.ok(event && typeof event === 'object')
    assert.equal('type' in event && event.type, 'restart')
    assert.equal('reason' in event && event.reason, 'server graph restart')
    assert.equal('timestamp' in event && typeof event.timestamp, 'number')
  })
})
