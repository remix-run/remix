import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as process from 'node:process'
import { performance } from 'node:perf_hooks'

import { getLargeFixture } from './fixture.ts'
import { createScriptHandler } from '../src/index.ts'
import type { ScriptHandler, ScriptHandlerOptions } from '../src/index.ts'

let scriptBase = '/scripts'

interface Benchmark {
  id: string
  name: string
  prepare(): Promise<() => Promise<void>>
}

interface ParsedOptions {
  benchmarkId?: string
  times: number
  warmupTimes: number
}

interface BenchmarkStats {
  meanMs: number
  stdDevMs: number
}

interface BenchmarkResult {
  summary: string
  stats: BenchmarkStats
}

interface BenchmarkResults {
  [benchmarkName: string]: BenchmarkResult
}

let benchmarks: Benchmark[] = [
  {
    id: 'large-cold-entry',
    name: 'large fixture graph / cold entry',
    async prepare() {
      let fixture = await getLargeFixture()
      return async function run() {
        let handler = createBenchHandler(fixture.root, fixture.entryPoint, {
          workspaceRoot: fixture.workspaceRoot,
        })
        await readHandledResponse(handler, toEntryPathname(fixture.entryPoint))
      }
    },
  },
  {
    id: 'large-warm-entry',
    name: 'large fixture graph / warm entry',
    async prepare() {
      let fixture = await getLargeFixture()
      let handler = createBenchHandler(fixture.root, fixture.entryPoint, {
        workspaceRoot: fixture.workspaceRoot,
      })
      await readHandledResponse(handler, toEntryPathname(fixture.entryPoint))
      return async function run() {
        await readHandledResponse(handler, toEntryPathname(fixture.entryPoint))
      }
    },
  },
  {
    id: 'large-preloads',
    name: 'large fixture graph / warm preloads',
    async prepare() {
      let fixture = await getLargeFixture()
      let handler = createBenchHandler(fixture.root, fixture.entryPoint, {
        workspaceRoot: fixture.workspaceRoot,
      })
      let initialUrls = await handler.preloads(fixture.entryPoint)
      assert.ok(initialUrls.length > 0, 'expected preload URLs for checked-in fixture')
      assert.ok(
        initialUrls.some((url) => url.includes('/__@workspace/')),
        'expected workspace preload URLs',
      )
      assert.ok(
        initialUrls.some((url) =>
          url.includes(
            '/__@workspace/packages/script-handler/bench/fixtures/large-fixture/packages/ui/',
          ),
        ),
        'expected checked-in fixture package preload URLs',
      )
      return async function run() {
        let urls = await handler.preloads(fixture.entryPoint)
        assert.ok(urls.length > 0, 'expected warm preload URLs')
        assert.ok(
          urls.some((url) => url.includes('/__@workspace/')),
          'expected workspace URLs',
        )
      }
    },
  },
  {
    id: 'large-module-burst',
    name: 'large fixture graph / internal module burst',
    async prepare() {
      let fixture = await getLargeFixture()
      let handler = createBenchHandler(fixture.root, fixture.entryPoint, {
        workspaceRoot: fixture.workspaceRoot,
      })
      let preloadUrls = await handler.preloads(fixture.entryPoint)
      let internalUrls = preloadUrls.filter((url) => url.includes('.@'))
      assert.ok(internalUrls.length > 0, 'expected hashed internal module URLs')
      assert.ok(
        internalUrls.some((url) => url.includes('/__@workspace/')),
        'expected hashed workspace URLs',
      )
      return async function run() {
        await Promise.all(internalUrls.map((url) => readHandledResponse(handler, url)))
      }
    },
  },
  {
    id: 'large-cold-entry-external-sourcemaps',
    name: 'large fixture graph / cold entry (external sourcemaps)',
    async prepare() {
      let fixture = await getLargeFixture()
      return async function run() {
        let handler = createBenchHandler(fixture.root, fixture.entryPoint, {
          workspaceRoot: fixture.workspaceRoot,
          sourceMaps: 'external',
        })
        await readHandledResponse(handler, toEntryPathname(fixture.entryPoint))
      }
    },
  },
]

function createBenchHandler(
  root: string,
  entryPoint: string,
  overrides: Partial<ScriptHandlerOptions> = {},
): ScriptHandler {
  let options: ScriptHandlerOptions = {
    entryPoints: [entryPoint],
    root,
    base: scriptBase,
    ...overrides,
  }

  return createScriptHandler(options)
}

function toEntryPathname(entryPoint: string): string {
  return `${scriptBase}/${entryPoint}`
}

function toModulePath(pathname: string): string {
  return pathname.replace(/^\/scripts\/?/, '')
}

function createRequest(pathname: string): Request {
  return new Request(`http://localhost${pathname}`)
}

async function readHandledResponse(handler: ScriptHandler, pathname: string): Promise<void> {
  let response = await handler.handle(createRequest(pathname), toModulePath(pathname))
  assert.ok(response, `expected response for ${pathname}`)
  assert.equal(response.status, 200, `expected 200 response for ${pathname}`)
  await response.text()
}

function getBenchmarkStats(measurements: number[]): BenchmarkStats {
  let meanMs = measurements.reduce((sum, measurement) => sum + measurement, 0) / measurements.length
  let variance =
    measurements.reduce((sum, measurement) => sum + (measurement - meanMs) ** 2, 0) /
    measurements.length
  let stdDevMs = Math.sqrt(variance)
  return { meanMs, stdDevMs }
}

function getBenchmarkResult(measurements: number[]): BenchmarkResult {
  let stats = getBenchmarkStats(measurements)
  return {
    summary: `${stats.meanMs.toFixed(2)} ms ± ${stats.stdDevMs.toFixed(2)}`,
    stats,
  }
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

  let benchmarkId: string | undefined = positionalArgs[0]
  let timesArg = positionalArgs[1]

  if (timesArg === undefined && benchmarkId !== undefined && /^\d+$/.test(benchmarkId)) {
    timesArg = benchmarkId
    benchmarkId = undefined
  }

  let times = timesArg === undefined ? 20 : Number.parseInt(timesArg, 10)
  if (!Number.isFinite(times) || times <= 0) {
    throw new Error(`Invalid iterations "${timesArg}". Expected a positive integer`)
  }

  if (benchmarkId !== undefined && !benchmarks.some((benchmark) => benchmark.id === benchmarkId)) {
    let availableIds = benchmarks.map((benchmark) => benchmark.id).join(', ')
    throw new Error(
      `Unknown benchmark id "${benchmarkId}". Use one of: ${availableIds} (or omit for all cases)`,
    )
  }

  let warmupTimes = 3
  for (let arg of optionArgs) {
    if (arg.startsWith('--warmup=')) {
      let parsedWarmupTimes = Number.parseInt(arg.slice('--warmup='.length), 10)
      if (!Number.isFinite(parsedWarmupTimes) || parsedWarmupTimes < 0) {
        throw new Error(`Invalid warmup iteration count "${arg}"`)
      }
      warmupTimes = parsedWarmupTimes
      continue
    }

    throw new Error(`Unknown option "${arg}". Supported options: --warmup=<count>`)
  }

  return { benchmarkId, times, warmupTimes }
}

async function runBenchmark(
  benchmark: Benchmark,
  options: ParsedOptions,
): Promise<BenchmarkResult> {
  let run = await benchmark.prepare()

  for (let i = 0; i < options.warmupTimes; ++i) {
    await run()
  }

  let measurements: number[] = []
  for (let i = 0; i < options.times; ++i) {
    let startedAt = performance.now()
    await run()
    measurements.push(performance.now() - startedAt)
  }

  return getBenchmarkResult(measurements)
}

async function runBenchmarks(options: ParsedOptions): Promise<BenchmarkResults> {
  let results: BenchmarkResults = {}

  for (let benchmark of benchmarks) {
    if (options.benchmarkId !== undefined && benchmark.id !== options.benchmarkId) {
      continue
    }

    results[benchmark.name] = await runBenchmark(benchmark, options)
  }

  return results
}

function printResults(results: BenchmarkResults, options: ParsedOptions): void {
  console.log(`Platform: ${os.type()} (${os.release()})`)
  console.log(`CPU: ${os.cpus()[0].model}`)
  console.log(`Date: ${new Date().toLocaleString()}`)
  console.log(`Node.js ${process.version}`)
  console.log(`Iterations: ${options.times}`)
  console.log(`Warmups: ${options.warmupTimes}`)

  let summaryResults: Record<string, string> = {}
  for (let benchmarkName of Object.keys(results)) {
    summaryResults[benchmarkName] = results[benchmarkName].summary
  }

  console.table(summaryResults)
}

let options = parseArgOptions()

let fixture = await getLargeFixture()
console.log(
  `Fixture modules: project=${fixture.stats.projectModules}, workspace=${fixture.stats.workspaceModules}`,
)

runBenchmarks(options).then(
  (results) => {
    printResults(results, options)
  },
  (error: unknown) => {
    console.error(error)
    process.exit(1)
  },
)
