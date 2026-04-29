import { createRequire, syncBuiltinESMExports } from 'node:module'
import type * as WorkerThreads from 'node:worker_threads'
import type { Worker as WorkerInstance } from 'node:worker_threads'

type WorkerConstructor = typeof WorkerThreads.Worker
type MutableWorkerThreadsModule = Omit<typeof WorkerThreads, 'Worker'> & {
  Worker: WorkerConstructor
}

const require = createRequire(import.meta.url)

export function installWorkerThreadCleanup(): { cleanup(): Promise<void> } {
  let workerThreads = require('node:worker_threads') as MutableWorkerThreadsModule
  let OriginalWorker = workerThreads.Worker
  let workers = new Set<WorkerInstance>()

  class TrackedWorker extends OriginalWorker {
    constructor(...args: ConstructorParameters<WorkerConstructor>) {
      super(...args)
      workers.add(this)
      this.once('exit', () => workers.delete(this))
    }
  }

  workerThreads.Worker = TrackedWorker
  syncBuiltinESMExports()

  return {
    async cleanup() {
      workerThreads.Worker = OriginalWorker
      syncBuiltinESMExports()

      let leakedWorkers = [...workers]
      workers.clear()
      await Promise.all(leakedWorkers.map((worker) => worker.terminate()))
    },
  }
}
