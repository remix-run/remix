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

export function sendResults(results: TestResults): void {
  if (isWorkerThread) {
    parentPort!.postMessage(results)
  } else {
    process.send!(results)
  }
}
