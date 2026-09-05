import * as os from 'node:os'
import * as path from 'node:path'
import { spawn } from 'node:child_process'

import { libraryIds, workloadIds } from './types.ts'
import type {
  ImportResult,
  LibraryId,
  RetainedResult,
  SchemaResult,
  ValidationResult,
  WorkerResult,
  WorkloadId,
} from './types.ts'

const defaultTrials = 5
const workerPath = path.join(import.meta.dirname, 'worker.ts')

function median(values: number[]): number {
  let sorted = values.toSorted((left, right) => left - right)
  let middle = Math.floor(sorted.length / 2)
  let value = sorted[middle]
  if (value === undefined) throw new Error('Cannot take the median of an empty array')
  if (sorted.length % 2 === 1) return value
  let previous = sorted[middle - 1]
  if (previous === undefined) throw new Error('Invalid median input')
  return (previous + value) / 2
}

function formatBytes(value: number): string {
  let absolute = Math.abs(value)
  if (absolute >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MiB`
  if (absolute >= 1024) return `${(value / 1024).toFixed(2)} KiB`
  return `${value.toFixed(0)} B`
}

function formatOps(value: number): string {
  return value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M ops/s`
    : `${(value / 1_000).toFixed(1)}k ops/s`
}

function runWorker(
  mode: WorkerResult['mode'],
  library: LibraryId,
  workload?: WorkloadId,
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    let child = spawn(
      process.execPath,
      ['--expose-gc', workerPath, mode, library, ...(workload ? [workload] : [])],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (stdout += chunk))
    child.stderr.on('data', (chunk: string) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker failed (${mode}/${library}/${workload ?? '-'}): ${stderr}`))
        return
      }

      try {
        resolve(parseWorkerResult(JSON.parse(stdout)))
      } catch (error) {
        reject(new Error(`Invalid worker output: ${stdout}`, { cause: error }))
      }
    })
  })
}

function readString(value: object, key: string): string {
  let result = Reflect.get(value, key)
  if (typeof result !== 'string') throw new Error(`Expected ${key} to be a string`)
  return result
}

function readNumber(value: object, key: string): number {
  let result = Reflect.get(value, key)
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error(`Expected ${key} to be a finite number`)
  }
  return result
}

function parseWorkerResult(value: unknown): WorkerResult {
  if (typeof value !== 'object' || value === null) throw new Error('Expected an object')
  let mode = readString(value, 'mode')
  let libraryValue = readString(value, 'library')
  let library = libraryIds.find((candidate) => candidate === libraryValue)
  if (library === undefined) throw new Error(`Unknown result library: ${libraryValue}`)

  switch (mode) {
    case 'import':
      return {
        mode,
        library,
        heapUsedDelta: readNumber(value, 'heapUsedDelta'),
        heapTotalDelta: readNumber(value, 'heapTotalDelta'),
        rssDelta: readNumber(value, 'rssDelta'),
        externalDelta: readNumber(value, 'externalDelta'),
      }
    case 'schema':
      return {
        mode,
        library,
        count: readNumber(value, 'count'),
        retainedHeapBytesPerSchema: readNumber(value, 'retainedHeapBytesPerSchema'),
        rssBytesPerSchema: readNumber(value, 'rssBytesPerSchema'),
      }
    case 'validate':
    case 'retain': {
      let workloadValue = readString(value, 'workload')
      let workload = workloadIds.find((candidate) => candidate === workloadValue)
      if (workload === undefined) throw new Error(`Unknown result workload: ${workloadValue}`)
      if (mode === 'validate') {
        return {
          mode,
          library,
          workload,
          iterations: readNumber(value, 'iterations'),
          operationsPerSecond: readNumber(value, 'operationsPerSecond'),
          peakHeapDelta: readNumber(value, 'peakHeapDelta'),
          peakRssDelta: readNumber(value, 'peakRssDelta'),
          retainedHeapDelta: readNumber(value, 'retainedHeapDelta'),
        }
      }
      return {
        mode,
        library,
        workload,
        count: readNumber(value, 'count'),
        retainedHeapBytesPerResult: readNumber(value, 'retainedHeapBytesPerResult'),
      }
    }
    default:
      throw new Error(`Unknown result mode: ${mode}`)
  }
}

function repeat(
  trials: number,
  mode: 'import',
  library: LibraryId,
  workload?: WorkloadId,
): Promise<ImportResult[]>
function repeat(
  trials: number,
  mode: 'schema',
  library: LibraryId,
  workload?: WorkloadId,
): Promise<SchemaResult[]>
function repeat(
  trials: number,
  mode: 'validate',
  library: LibraryId,
  workload?: WorkloadId,
): Promise<ValidationResult[]>
function repeat(
  trials: number,
  mode: 'retain',
  library: LibraryId,
  workload?: WorkloadId,
): Promise<RetainedResult[]>
async function repeat(
  trials: number,
  mode: WorkerResult['mode'],
  library: LibraryId,
  workload?: WorkloadId,
): Promise<WorkerResult[]> {
  let results: WorkerResult[] = []
  for (let trial = 0; trial < trials; trial++) {
    let result = await runWorker(mode, library, workload)
    if (result.mode !== mode) throw new Error(`Expected ${mode} result, received ${result.mode}`)
    results.push(result)
  }
  return results
}

async function main(): Promise<void> {
  let trials = Number.parseInt(process.argv[2] ?? String(defaultTrials), 10)
  if (!Number.isSafeInteger(trials) || trials < 1) throw new Error('Trials must be positive')

  console.log(`Platform: ${os.type()} ${os.release()} (${os.arch()})`)
  console.log(`CPU: ${os.cpus()[0]?.model ?? 'unknown'}`)
  console.log(`Node: ${process.version}`)
  console.log(`Trials: ${trials} (median reported; each trial uses a fresh process)\n`)

  let importTable: Record<string, Record<string, string>> = {}
  for (let library of libraryIds) {
    let results = await repeat(trials, 'import', library)
    importTable[library] = {
      'heap used': formatBytes(median(results.map((result) => result.heapUsedDelta))),
      'heap capacity': formatBytes(median(results.map((result) => result.heapTotalDelta))),
      RSS: formatBytes(median(results.map((result) => result.rssDelta))),
    }
  }
  console.log('Cold module import footprint')
  console.table(importTable)

  let schemaTable: Record<string, Record<string, string>> = {}
  for (let library of libraryIds) {
    let results = await repeat(trials, 'schema', library)
    schemaTable[library] = {
      'retained heap/schema': formatBytes(
        median(results.map((result) => result.retainedHeapBytesPerSchema)),
      ),
      'RSS/schema': formatBytes(median(results.map((result) => result.rssBytesPerSchema))),
    }
  }
  console.log('\nRetained memory for 2,000 independently constructed equivalent schemas')
  console.table(schemaTable)

  let throughputTable: Record<string, Record<string, string>> = {}
  let peakTable: Record<string, Record<string, string>> = {}
  let peakRssTable: Record<string, Record<string, string>> = {}
  for (let library of libraryIds) {
    throughputTable[library] = {}
    peakTable[library] = {}
    peakRssTable[library] = {}
    for (let workload of workloadIds) {
      let results = await repeat(trials, 'validate', library, workload)
      throughputTable[library][workload] = formatOps(
        median(results.map((result) => result.operationsPerSecond)),
      )
      peakTable[library][workload] = formatBytes(
        median(results.map((result) => result.peakHeapDelta)),
      )
      peakRssTable[library][workload] = formatBytes(
        median(results.map((result) => result.peakRssDelta)),
      )
    }
  }
  console.log('\nValidation throughput')
  console.table(throughputTable)
  console.log('\nPeak heap growth during validation batch')
  console.table(peakTable)
  console.log('\nPeak RSS growth during validation batch')
  console.table(peakRssTable)

  let retainedResultTable: Record<string, Record<string, string>> = {}
  for (let library of libraryIds) {
    retainedResultTable[library] = {}
    for (let workload of workloadIds) {
      let results = await repeat(trials, 'retain', library, workload)
      retainedResultTable[library][workload] = formatBytes(
        median(results.map((result) => result.retainedHeapBytesPerResult)),
      )
    }
  }
  console.log('\nRetained heap per validation result')
  console.table(retainedResultTable)
}

await main()
