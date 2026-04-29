import * as assert from '@remix-run/assert'
import { once } from 'node:events'
import { describe, it } from '../lib/framework.ts'
import { IS_BUN } from '../lib/runtime.ts'
import { installWorkerThreadCleanup } from '../lib/worker-thread-cleanup.ts'

describe('worker cleanup', () => {
  it('terminates tracked worker threads during cleanup', { skip: IS_BUN }, async () => {
    let cleanup = installWorkerThreadCleanup()
    let { Worker } = await import('node:worker_threads')
    let worker = new Worker('setInterval(() => {}, 1000)', { eval: true })
    let exited = new Promise<number>((resolve) => {
      worker.once('exit', resolve)
    })

    await once(worker, 'online')
    await cleanup.cleanup()

    assert.equal(await exited, 1)
  })
})
