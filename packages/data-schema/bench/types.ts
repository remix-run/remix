export const libraryIds = ['data-schema', 'zod', 'valibot'] as const
export type LibraryId = (typeof libraryIds)[number]

export const workloadIds = [
  'valid-object',
  'invalid-object',
  'valid-array',
  'invalid-array',
] as const
export type WorkloadId = (typeof workloadIds)[number]

export interface PreparedBenchmark {
  expectedSuccess: boolean
  run(): unknown
}

export interface BenchmarkAdapter {
  createSchema(): object
  prepare(workload: WorkloadId): PreparedBenchmark
}

export type MemorySnapshot = {
  heapUsed: number
  heapTotal: number
  rss: number
  external: number
}

export type ImportResult = {
  mode: 'import'
  library: LibraryId
  heapUsedDelta: number
  heapTotalDelta: number
  rssDelta: number
  externalDelta: number
}

export type SchemaResult = {
  mode: 'schema'
  library: LibraryId
  count: number
  retainedHeapBytesPerSchema: number
  rssBytesPerSchema: number
}

export type ValidationResult = {
  mode: 'validate'
  library: LibraryId
  workload: WorkloadId
  iterations: number
  operationsPerSecond: number
  peakHeapDelta: number
  peakRssDelta: number
  retainedHeapDelta: number
}

export type RetainedResult = {
  mode: 'retain'
  library: LibraryId
  workload: WorkloadId
  count: number
  retainedHeapBytesPerResult: number
}

export type WorkerResult = ImportResult | SchemaResult | ValidationResult | RetainedResult
