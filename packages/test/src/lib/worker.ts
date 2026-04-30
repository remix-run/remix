import { parentPort, workerData } from 'node:worker_threads'
import { runServerTestFile } from './worker-server.ts'

if (!parentPort) {
  throw new Error('Server test worker is missing a parent port')
}

const results = await runServerTestFile(workerData)
parentPort.postMessage(results)
process.exit(0)
