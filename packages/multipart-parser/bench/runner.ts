import * as os from 'node:os'
import * as process from 'node:process'

import * as messages from './messages.ts'
import * as busboy from './parsers/busboy.ts'
import * as fastifyBusboy from './parsers/fastify-busboy.ts'
import * as multipartParser from './parsers/multipart-parser.ts'
import * as multipasta from './parsers/multipasta.ts'

const benchmarks = [
  { id: '1-small-file', name: '1 small file', message: messages.oneSmallFile },
  { id: '1-large-file', name: '1 large file', message: messages.oneLargeFile },
  { id: '100-small-files', name: '100 small files', message: messages.oneHundredSmallFiles },
  { id: '5-large-files', name: '5 large files', message: messages.fiveLargeFiles },
  {
    id: '1-large-file-adversarial',
    name: '1 large file (adversarial)',
    message: messages.oneLargeFileAdversarial,
  },
  {
    id: '5-large-files-adversarial',
    name: '5 large files (adversarial)',
    message: messages.fiveLargeFilesAdversarial,
  },
]

interface Parser {
  parse(message: messages.MultipartMessage): Promise<number>
}

interface ParsedOptions {
  parserName?: string
  benchmarkId?: string
  times?: number
  warmupTimes: number
  metrics: boolean
  steady: boolean
}

interface BenchmarkStats {
  meanMs: number
  stdDevMs: number
  throughputMibPerSec: number
  heapDeltaBytesPerOp: number
  retainedHeapBytesPerOp: number
}

interface BenchmarkResult {
  summary: string
  stats?: BenchmarkStats
}

async function runParserBenchmarks(
  parser: Parser,
  options?: ParsedOptions,
): Promise<BenchmarkResults[string]> {
  let results: BenchmarkResults[string] = {}
  let times = options?.times ?? 200
  let warmupTimes = options?.steady ? options.warmupTimes : 0

  for (let benchmark of benchmarks) {
    if (options?.benchmarkId !== undefined && benchmark.id !== options.benchmarkId) {
      continue
    }

    if (options?.steady) {
      benchmark.message.getChunks()
    }

    for (let i = 0; i < warmupTimes; ++i) {
      await parser.parse(benchmark.message)
    }

    let beforeHeapUsed = getHeapUsed()
    if (options?.metrics) {
      runGc()
    }
    let beforeRetainedHeap = getHeapUsed()

    let measurements: number[] = []
    for (let i = 0; i < times; ++i) {
      measurements.push(await parser.parse(benchmark.message))
    }

    let afterHeapUsed = getHeapUsed()
    if (options?.metrics) {
      runGc()
    }
    let afterRetainedHeap = getHeapUsed()

    results[benchmark.name] = getBenchmarkResult(
      measurements,
      benchmark.message.content.length,
      (afterHeapUsed - beforeHeapUsed) / times,
      (afterRetainedHeap - beforeRetainedHeap) / times,
      options?.metrics === true,
    )
  }

  return results
}

function getBenchmarkStats(
  measurements: number[],
  messageSizeBytes: number,
  heapDeltaBytesPerOp: number,
  retainedHeapBytesPerOp: number,
): BenchmarkStats {
  let mean = measurements.reduce((a, b) => a + b, 0) / measurements.length
  let variance = measurements.reduce((a, b) => a + (b - mean) ** 2, 0) / measurements.length
  let stdDev = Math.sqrt(variance)
  let throughputMibPerSec = messageSizeBytes / (1024 * 1024) / (mean / 1000)

  return {
    meanMs: mean,
    stdDevMs: stdDev,
    throughputMibPerSec,
    heapDeltaBytesPerOp,
    retainedHeapBytesPerOp,
  }
}

interface BenchmarkResults {
  [parserName: string]: {
    [benchmarkName: string]: BenchmarkResult
  }
}

function getBenchmarkResult(
  measurements: number[],
  messageSizeBytes: number,
  heapDeltaBytesPerOp: number,
  retainedHeapBytesPerOp: number,
  withStats: boolean,
): BenchmarkResult {
  let stats = getBenchmarkStats(
    measurements,
    messageSizeBytes,
    heapDeltaBytesPerOp,
    retainedHeapBytesPerOp,
  )

  return {
    summary: `${stats.meanMs.toFixed(2)} ms ± ${stats.stdDevMs.toFixed(2)}`,
    stats: withStats ? stats : undefined,
  }
}

function getHeapUsed(): number {
  if (typeof process.memoryUsage !== 'function') {
    return 0
  }
  return process.memoryUsage().heapUsed
}

function runGc(): void {
  let gc = (globalThis as unknown as { gc?: () => void }).gc
  gc?.()
}

function parseArgOptions(): ParsedOptions {
  let args = process.argv.slice(2)
  if (args[0] === '--') {
    args = args.slice(1)
  }

  let positionalArgs: string[] = []
  let optionArgs: string[] = []
  for (let arg of args) {
    if (arg.startsWith('--')) {
      optionArgs.push(arg)
    } else {
      positionalArgs.push(arg)
    }
  }

  let parserName = positionalArgs[0]
  let benchmarkId = positionalArgs[1]
  let timesArg = positionalArgs[2]

  if (timesArg === undefined && benchmarkId !== undefined && /^\d+$/.test(benchmarkId)) {
    timesArg = benchmarkId
    benchmarkId = undefined
  }
  let times = timesArg === undefined ? undefined : Number.parseInt(timesArg, 10)

  if (benchmarkId !== undefined && !benchmarks.some((benchmark) => benchmark.id === benchmarkId)) {
    let availableIds = benchmarks.map((benchmark) => benchmark.id).join(', ')
    throw new Error(
      `Unknown benchmark id "${benchmarkId}". Use one of: ${availableIds} (or omit for all cases)`,
    )
  }

  if (times !== undefined && (!Number.isFinite(times) || times <= 0)) {
    throw new Error(`Invalid iterations "${timesArg}". Expected a positive integer`)
  }

  let steady = false
  let metrics = false
  let warmupTimes = 50

  for (let arg of optionArgs) {
    if (arg === '--') {
      continue
    }

    if (arg === '--steady') {
      steady = true
      continue
    }

    if (arg === '--metrics') {
      metrics = true
      continue
    }

    if (arg.startsWith('--warmup=')) {
      let parsedWarmupTimes = Number.parseInt(arg.slice('--warmup='.length), 10)
      if (!Number.isFinite(parsedWarmupTimes) || parsedWarmupTimes < 0) {
        throw new Error(`Invalid warmup iteration count "${arg}"`)
      }
      warmupTimes = parsedWarmupTimes
      continue
    }

    throw new Error(
      `Unknown option "${arg}". Supported options: --steady, --metrics, --warmup=<count>`,
    )
  }

  return { parserName, benchmarkId, times, warmupTimes, metrics, steady }
}

async function runBenchmarks(
  parserName?: string,
  options?: ParsedOptions,
): Promise<BenchmarkResults> {
  let results: BenchmarkResults = {}

  if (parserName === 'multipart-parser' || parserName === undefined) {
    results['multipart-parser'] = await runParserBenchmarks(multipartParser, options)
  }
  if (parserName === 'multipasta' || parserName === undefined) {
    results['multipasta'] = await runParserBenchmarks(multipasta, options)
  }
  if (parserName === 'busboy' || parserName === undefined) {
    results.busboy = await runParserBenchmarks(busboy, options)
  }
  if (parserName === 'fastify-busboy' || parserName === undefined) {
    results['@fastify/busboy'] = await runParserBenchmarks(fastifyBusboy, options)
  }

  return results
}

function printResults(results: BenchmarkResults) {
  console.log(`Platform: ${os.type()} (${os.release()})`)
  console.log(`CPU: ${os.cpus()[0].model}`)
  console.log(`Date: ${new Date().toLocaleString()}`)

  if (typeof Bun !== 'undefined') {
    console.log(`Bun ${Bun.version}`)
  } else if (typeof Deno !== 'undefined') {
    console.log(`Deno ${Deno.version.deno}`)
  } else {
    console.log(`Node.js ${process.version}`)
  }

  let summaryResults: Record<string, Record<string, string>> = {}
  for (let parserName of Object.keys(results)) {
    summaryResults[parserName] = {}
    for (let benchmarkName of Object.keys(results[parserName])) {
      summaryResults[parserName][benchmarkName] = results[parserName][benchmarkName].summary
    }
  }
  console.table(summaryResults)

  let hasStats = Object.values(results).some((resultByBenchmark) =>
    Object.values(resultByBenchmark).some((result) => result.stats !== undefined),
  )

  if (hasStats) {
    let metricResults: Record<string, Record<string, string>> = {}
    for (let parserName of Object.keys(results)) {
      metricResults[parserName] = {}
      for (let benchmarkName of Object.keys(results[parserName])) {
        let stats = results[parserName][benchmarkName].stats
        if (!stats) continue
        metricResults[parserName][benchmarkName] =
          `${stats.throughputMibPerSec.toFixed(2)} MiB/s | heapΔ ${stats.heapDeltaBytesPerOp.toFixed(0)} B/op | retainedΔ ${stats.retainedHeapBytesPerOp.toFixed(0)} B/op`
      }
    }
    console.log('\nThroughput and allocation metrics')
    console.table(metricResults)
  }
}

let options = parseArgOptions()

runBenchmarks(options.parserName, {
  benchmarkId: options.benchmarkId,
  times: options.times,
  warmupTimes: options.warmupTimes,
  metrics: options.metrics,
  steady: options.steady,
}).then(printResults, (error) => {
  console.error(error)
  process.exit(1)
})
