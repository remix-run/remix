import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

import { libraryIds, workloadIds } from './types.ts'
import type {
  BenchmarkAdapter,
  ImportResult,
  LibraryId,
  MemorySnapshot,
  RetainedResult,
  SchemaResult,
  ValidationResult,
  WorkerResult,
  WorkloadId,
} from './types.ts'

type Mode = WorkerResult['mode']

const schemaCount = 2_000
const warmupIterations = 2_000
const objectIterations = 20_000
const arrayIterations = 500

function collectGarbage(): void {
  if (globalThis.gc === undefined) {
    throw new Error('Run the benchmark worker with --expose-gc')
  }

  for (let index = 0; index < 3; index++) globalThis.gc()
}

function getMemory(): MemorySnapshot {
  let memory = process.memoryUsage()
  return {
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    rss: memory.rss,
    external: memory.external,
  }
}

async function loadAdapter(library: LibraryId): Promise<BenchmarkAdapter> {
  switch (library) {
    case 'data-schema':
      return (await import('./adapters/data-schema.ts')).adapter
    case 'zod':
      return (await import('./adapters/zod.ts')).adapter
    case 'valibot':
      return (await import('./adapters/valibot.ts')).adapter
  }
}

async function measureImport(library: LibraryId): Promise<ImportResult> {
  collectGarbage()
  let before = getMemory()
  let adapter = await loadAdapter(library)
  assert.equal(typeof adapter.createSchema, 'function')
  collectGarbage()
  let after = getMemory()

  return {
    mode: 'import',
    library,
    heapUsedDelta: after.heapUsed - before.heapUsed,
    heapTotalDelta: after.heapTotal - before.heapTotal,
    rssDelta: after.rss - before.rss,
    externalDelta: after.external - before.external,
  }
}

async function measureSchema(library: LibraryId): Promise<SchemaResult> {
  let adapter = await loadAdapter(library)
  adapter.createSchema()
  collectGarbage()
  let before = getMemory()
  let schemas: object[] = []

  for (let index = 0; index < schemaCount; index++) schemas.push(adapter.createSchema())

  collectGarbage()
  let after = getMemory()
  assert.equal(schemas.length, schemaCount)
  assert.ok(schemas[0] !== schemas[schemaCount - 1])

  return {
    mode: 'schema',
    library,
    count: schemaCount,
    retainedHeapBytesPerSchema: (after.heapUsed - before.heapUsed) / schemaCount,
    rssBytesPerSchema: (after.rss - before.rss) / schemaCount,
  }
}

function getIterations(workload: WorkloadId): number {
  if (workload === 'invalid-array') return 100
  if (workload === 'valid-array') return arrayIterations
  if (workload === 'invalid-object') return 5_000
  return objectIterations
}

function getWarmupIterations(workload: WorkloadId): number {
  return workload.endsWith('-array') ? 50 : warmupIterations
}

function verifyResult(result: unknown, expectedSuccess: boolean): void {
  if (
    typeof result !== 'object' ||
    result === null ||
    Reflect.get(result, 'success') !== expectedSuccess
  ) {
    throw new Error(`Validation result did not have success=${String(expectedSuccess)}`)
  }
}

async function measureValidation(
  library: LibraryId,
  workload: WorkloadId,
): Promise<ValidationResult> {
  let adapter = await loadAdapter(library)
  let benchmark = adapter.prepare(workload)
  for (let index = 0; index < getWarmupIterations(workload); index++) {
    verifyResult(benchmark.run(), benchmark.expectedSuccess)
  }

  collectGarbage()
  let before = getMemory()
  let peakHeapUsed = before.heapUsed
  let peakRss = before.rss
  let iterations = getIterations(workload)
  let retainedResults: unknown[] = new Array(256)
  let startedAt = performance.now()

  for (let index = 0; index < iterations; index++) {
    let result = benchmark.run()
    verifyResult(result, benchmark.expectedSuccess)
    retainedResults[index % retainedResults.length] = result
    if (index % 50 === 0) {
      let memory = process.memoryUsage()
      peakHeapUsed = Math.max(peakHeapUsed, memory.heapUsed)
      peakRss = Math.max(peakRss, memory.rss)
    }
  }

  let elapsed = performance.now() - startedAt
  let beforeGc = getMemory()
  peakHeapUsed = Math.max(peakHeapUsed, beforeGc.heapUsed)
  peakRss = Math.max(peakRss, beforeGc.rss)
  retainedResults.length = 0
  collectGarbage()
  let afterGc = getMemory()

  return {
    mode: 'validate',
    library,
    workload,
    iterations,
    operationsPerSecond: iterations / (elapsed / 1_000),
    peakHeapDelta: peakHeapUsed - before.heapUsed,
    peakRssDelta: peakRss - before.rss,
    retainedHeapDelta: afterGc.heapUsed - before.heapUsed,
  }
}

function getRetentionCount(workload: WorkloadId): number {
  if (workload === 'invalid-array') return 20
  if (workload === 'valid-array') return 100
  return 2_000
}

async function measureRetainedResults(
  library: LibraryId,
  workload: WorkloadId,
): Promise<RetainedResult> {
  let adapter = await loadAdapter(library)
  let benchmark = adapter.prepare(workload)
  for (let index = 0; index < getWarmupIterations(workload); index++) {
    verifyResult(benchmark.run(), benchmark.expectedSuccess)
  }

  collectGarbage()
  let before = getMemory()
  let count = getRetentionCount(workload)
  let retainedResults: unknown[] = []
  for (let index = 0; index < count; index++) {
    let result = benchmark.run()
    verifyResult(result, benchmark.expectedSuccess)
    retainedResults.push(result)
  }
  collectGarbage()
  let after = getMemory()
  assert.equal(retainedResults.length, count)
  assert.ok(retainedResults[0] !== retainedResults[count - 1])

  return {
    mode: 'retain',
    library,
    workload,
    count,
    retainedHeapBytesPerResult: (after.heapUsed - before.heapUsed) / count,
  }
}

function parseLibrary(value: string | undefined): LibraryId {
  for (let library of libraryIds) if (library === value) return library
  throw new Error(`Unknown library: ${value ?? '<missing>'}`)
}

function parseWorkload(value: string | undefined): WorkloadId {
  for (let workload of workloadIds) if (workload === value) return workload
  throw new Error(`Unknown workload: ${value ?? '<missing>'}`)
}

function parseMode(value: string | undefined): Mode {
  switch (value) {
    case 'import':
    case 'schema':
    case 'validate':
    case 'retain':
      return value
    default:
      throw new Error(`Unknown mode: ${value ?? '<missing>'}`)
  }
}

async function main(): Promise<void> {
  let mode = parseMode(process.argv[2])
  let library = parseLibrary(process.argv[3])
  let result: WorkerResult

  switch (mode) {
    case 'import':
      result = await measureImport(library)
      break
    case 'schema':
      result = await measureSchema(library)
      break
    case 'validate':
      result = await measureValidation(library, parseWorkload(process.argv[4]))
      break
    case 'retain':
      result = await measureRetainedResults(library, parseWorkload(process.argv[4]))
      break
  }

  process.stdout.write(JSON.stringify(result))
}

await main()
