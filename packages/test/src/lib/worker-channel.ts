import { parentPort, workerData as threadsWorkerData } from 'node:worker_threads'
import type { TestResults } from './reporters/results.ts'

/*
 * Worker entry points (`worker.ts`, `worker-e2e.ts`) run in two modes:
 * - Inside a `worker_threads.Worker` (pool=threads), using `parentPort` and
 *   `workerData`.
 * - Inside a `child_process.fork` subprocess (pool=forks), using `process.send`
 *   and an initial `process.on('message', ...)` payload from the parent.
 *
 * This module hides the difference so the worker bodies can stay pool-agnostic.
 */

export const isWorkerThread = parentPort != null

export function receiveWorkerData<T>(): T | Promise<T> {
  if (isWorkerThread) return threadsWorkerData as T
  return new Promise<T>((resolve) => {
    process.once('message', (msg) => resolve(msg as T))
  })
}

export async function sendResults(results: TestResults): Promise<void> {
  if (isWorkerThread) {
    parentPort!.postMessage(results)
  } else {
    await new Promise<void>((resolve, reject) => {
      process.send!(results, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }
}

export function closeWorkerChannel(): void {
  if (!isWorkerThread && process.connected) {
    process.disconnect?.()
  }

  // Force worker shutdown for both pools so leaked handles in test files
  // cannot keep a worker process/thread alive after results are sent.
  process.exit(0)
}
