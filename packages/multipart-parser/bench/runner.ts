import * as os from 'node:os'
import * as process from 'node:process'

import * as messages from './messages.ts'
import * as busboy from './parsers/busboy.ts'
import * as fastifyBusboy from './parsers/fastify-busboy.ts'
import * as multipartParser from './parsers/multipart-parser.ts'
import * as multipasta from './parsers/multipasta.ts'

const benchmarks = [
  { name: '1 small file', message: messages.oneSmallFile },
  { name: '1 large file', message: messages.oneLargeFile },
  { name: '100 small files', message: messages.oneHundredSmallFiles },
  { name: '5 large files', message: messages.fiveLargeFiles },
]

const config = {
  warmup: getNumberFromEnv('BENCH_WARMUP', 20),
  times: getNumberFromEnv('BENCH_TIMES', 200),
  rounds: getNumberFromEnv('BENCH_ROUNDS', 1),
}

interface Parser {
  parse(message: messages.MultipartMessage): Promise<number>
}

async function runParserBenchmarks(parser: Parser, times = config.times): Promise<BenchmarkResults[string]> {
  let results: BenchmarkResults[string] = {}

  for (let benchmark of benchmarks) {
    let measurements: number[] = []

    for (let i = 0; i < config.warmup; ++i) {
      await parser.parse(benchmark.message)
    }

    for (let round = 0; round < config.rounds; ++round) {
      for (let i = 0; i < times; ++i) {
        measurements.push(await parser.parse(benchmark.message))
      }

      if (typeof (globalThis as { gc?: () => void }).gc === 'function') {
        ;(globalThis as { gc: () => void }).gc()
      }
    }

    results[benchmark.name] = getStats(measurements)
  }

  return results
}

function getMeanAndStdDev(measurements: number[]): number[] {
  let mean = measurements.reduce((a, b) => a + b, 0) / measurements.length
  let variance = measurements.reduce((a, b) => a + (b - mean) ** 2, 0) / measurements.length
  let stdDev = Math.sqrt(variance)

  return [mean, stdDev]
}

function getPercentile(sorted: number[], percentile: number): number {
  let index = Math.floor((sorted.length - 1) * percentile)
  return sorted[index]
}

function getStats(measurements: number[]): string {
  let [mean, stdDev] = getMeanAndStdDev(measurements)
  let sorted = [...measurements].sort((a, b) => a - b)
  let median = getPercentile(sorted, 0.5)
  let p95 = getPercentile(sorted, 0.95)

  return `${mean.toFixed(2)} ms ± ${stdDev.toFixed(2)} ` +
    `(median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, n=${measurements.length})`
}

interface BenchmarkResults {
  [parserName: string]: {
    [benchmarkName: string]: string
  }
}

async function runBenchmarks(parserName?: string): Promise<BenchmarkResults> {
  let results: BenchmarkResults = {}

  if (parserName === 'multipart-parser' || parserName === undefined) {
    results['multipart-parser'] = await runParserBenchmarks(multipartParser)
  }
  if (parserName === 'multipasta' || parserName === undefined) {
    results['multipasta'] = await runParserBenchmarks(multipasta)
  }
  if (parserName === 'busboy' || parserName === undefined) {
    results.busboy = await runParserBenchmarks(busboy)
  }
  if (parserName === 'fastify-busboy' || parserName === undefined) {
    results['@fastify/busboy'] = await runParserBenchmarks(fastifyBusboy)
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

  console.table(results)
}

let parserName = process.argv[2]
if (parserName && /^\d+$/.test(parserName)) {
  config.times = Number(parserName)
  parserName = undefined
}

if (process.argv[3]) {
  config.times = Number(process.argv[3])
}

if (process.argv[4]) {
  config.warmup = Number(process.argv[4])
}

if (process.argv[5]) {
  config.rounds = Number(process.argv[5])
}

runBenchmarks(parserName).then(printResults, (error) => {
  console.error(error)
  process.exit(1)
})

function getNumberFromEnv(name: string, fallback: number): number {
  let value = process.env[name]
  if (value == null) return fallback
  let parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  return fallback
}
