import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { performance } from 'node:perf_hooks'

import { createAssetServer } from '@remix-run/assets'
import type { AssetServer, AssetServerOptions } from '@remix-run/assets'

import { getBasicFixture, getDeepGraphFixture } from './fixture.ts'
import type { BenchFixture } from './fixture.ts'

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

const benchmarks: Benchmark[] = [
  {
    id: 'basic-cold-entry',
    name: 'basic fixture / cold entry',
    async prepare() {
      let fixture = await getBasicFixture()
      return async function run() {
        let assetServer = createBenchAssetServer(fixture)
        let source = await readHandledResponseText(
          assetServer,
          await assetServer.getHref(fixture.entryPoint),
        )
        assertContainsSubstrings(source, fixture.expectedEntryUrlSubstrings, fixture.label)
      }
    },
  },
  {
    id: 'basic-warm-entry',
    name: 'basic fixture / warm entry',
    async prepare() {
      let fixture = await getBasicFixture()
      let assetServer = createBenchAssetServer(fixture)
      let source = await readHandledResponseText(
        assetServer,
        await assetServer.getHref(fixture.entryPoint),
      )
      assertContainsSubstrings(source, fixture.expectedEntryUrlSubstrings, fixture.label)
      return async function run() {
        let nextSource = await readHandledResponseText(
          assetServer,
          await assetServer.getHref(fixture.entryPoint),
        )
        assertContainsSubstrings(nextSource, fixture.expectedEntryUrlSubstrings, fixture.label)
      }
    },
  },
  {
    id: 'basic-cold-entry-minified',
    name: 'basic fixture / cold entry (minified)',
    async prepare() {
      let fixture = await getBasicFixture()
      return async function run() {
        let assetServer = createBenchAssetServer(fixture, { scripts: { minify: true } })
        let source = await readHandledResponseText(
          assetServer,
          await assetServer.getHref(fixture.entryPoint),
        )
        assertContainsSubstrings(source, fixture.expectedEntryUrlSubstrings, fixture.label)
      }
    },
  },
  {
    id: 'deep-graph-cold-preloads',
    name: 'deep-graph fixture / cold preloads',
    async prepare() {
      let fixture = await getDeepGraphFixture()
      return async function run() {
        let assetServer = createBenchAssetServer(fixture)
        let urls = await assetServer.getPreloads(fixture.entryPoint)
        assertPreloadUrls(urls, fixture)
      }
    },
  },
  {
    id: 'deep-graph-cold-preloads-minified',
    name: 'deep-graph fixture / cold preloads (minified)',
    async prepare() {
      let fixture = await getDeepGraphFixture()
      return async function run() {
        let assetServer = createBenchAssetServer(fixture, { scripts: { minify: true } })
        let urls = await assetServer.getPreloads(fixture.entryPoint)
        assertPreloadUrls(urls, fixture)
      }
    },
  },
  {
    id: 'deep-graph-warm-preloads',
    name: 'deep-graph fixture / warm preloads',
    async prepare() {
      let fixture = await getDeepGraphFixture()
      let assetServer = createBenchAssetServer(fixture)
      let initialUrls = await assetServer.getPreloads(fixture.entryPoint)
      assertPreloadUrls(initialUrls, fixture)
      return async function run() {
        let urls = await assetServer.getPreloads(fixture.entryPoint)
        assertPreloadUrls(urls, fixture)
      }
    },
  },
  {
    id: 'deep-graph-stable-warm-preloads',
    name: 'deep-graph fixture / stable warm preloads',
    async prepare() {
      let fixture = await getDeepGraphFixture()
      let assetServer = createStableBenchAssetServer(fixture)
      let initialUrls = await assetServer.getPreloads(fixture.entryPoint)
      assertPreloadUrls(initialUrls, fixture)
      return async function run() {
        let urls = await assetServer.getPreloads(fixture.entryPoint)
        assertPreloadUrls(urls, fixture)
      }
    },
  },
  {
    id: 'deep-graph-module-burst',
    name: 'deep-graph fixture / warm internal module burst',
    async prepare() {
      let fixture = await getDeepGraphFixture()
      let assetServer = createBenchAssetServer(fixture)
      let preloadUrls = await assetServer.getPreloads(fixture.entryPoint)
      assertPreloadUrls(preloadUrls, fixture)
      let internalUrls = preloadUrls.filter((url) => url.includes('.@'))
      assert.ok(internalUrls.length > 0, 'expected fingerprinted internal module URLs')
      assertContainsSubstrings(
        internalUrls.join('\n'),
        fixture.expectedPreloadUrlSubstrings,
        fixture.label,
      )
      return async function run() {
        await Promise.all(internalUrls.map((url) => readHandledResponse(assetServer, url)))
      }
    },
  },
  {
    id: 'deep-graph-stable-module-burst',
    name: 'deep-graph fixture / stable warm module burst',
    async prepare() {
      let fixture = await getDeepGraphFixture()
      let assetServer = createStableBenchAssetServer(fixture)
      let preloadUrls = await assetServer.getPreloads(fixture.entryPoint)
      assertPreloadUrls(preloadUrls, fixture)
      let internalUrls = preloadUrls.slice(1)
      assert.ok(internalUrls.length > 0, 'expected internal module URLs')
      assertContainsSubstrings(
        internalUrls.join('\n'),
        fixture.expectedPreloadUrlSubstrings,
        fixture.label,
      )
      return async function run() {
        await Promise.all(internalUrls.map((url) => readHandledResponse(assetServer, url)))
      }
    },
  },
]

function createBenchAssetServer(
  fixture: BenchFixture,
  overrides: Partial<AssetServerOptions> = {},
): AssetServer {
  let root = path.resolve(import.meta.dirname, '../../..')
  let options: AssetServerOptions = {
    fingerprint: {
      buildId: String(Date.now()),
    },
    root,
    ...fixture.assetServer,
    ...overrides,
  }

  return createAssetServer(options)
}

function createStableBenchAssetServer(
  fixture: BenchFixture,
  overrides: Partial<AssetServerOptions> = {},
): AssetServer {
  return createBenchAssetServer(fixture, {
    fingerprint: undefined,
    ...overrides,
  })
}

function createRequest(pathname: string): Request {
  return new Request(`http://localhost${pathname}`)
}

async function readHandledResponse(assetServer: AssetServer, pathname: string): Promise<void> {
  await readHandledResponseText(assetServer, pathname)
}

async function readHandledResponseText(
  assetServer: AssetServer,
  pathname: string,
): Promise<string> {
  let response = await assetServer.fetch(createRequest(pathname))
  assert.ok(response, `expected response for ${pathname}`)
  assert.equal(response.status, 200, `expected 200 response for ${pathname}`)
  return response.text()
}

function assertContainsSubstrings(
  value: string,
  expectedSubstrings: string[],
  label: string,
): void {
  for (let expectedSubstring of expectedSubstrings) {
    assert.ok(
      value.includes(expectedSubstring),
      `${label}: expected "${expectedSubstring}" to be present`,
    )
  }
}

function assertPreloadUrls(urls: string[], fixture: BenchFixture): void {
  assert.ok(urls.length > 0, `${fixture.label}: expected preload URLs`)
  assertContainsSubstrings(urls.join('\n'), fixture.expectedPreloadUrlSubstrings, fixture.label)
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

    throw new Error('Unknown option "' + arg + '". Supported options: --warmup=<count>')
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
  let cpuModel = os.cpus()[0]?.model ?? 'unknown'
  console.log(`Platform: ${os.type()} (${os.release()})`)
  console.log(`CPU: ${cpuModel}`)
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

function formatFixtureStats(fixture: BenchFixture): string {
  return fixture.stats.map((stat) => `${stat.label}=${stat.value}`).join(', ')
}

const benchOptions = parseArgOptions()

const [basicFixture, deepGraphFixture] = await Promise.all([
  getBasicFixture(),
  getDeepGraphFixture(),
])
console.log(`Fixture ${basicFixture.label}: ${formatFixtureStats(basicFixture)}`)
console.log(`Fixture ${deepGraphFixture.label}: ${formatFixtureStats(deepGraphFixture)}`)

runBenchmarks(benchOptions).then(
  (results) => {
    printResults(results, benchOptions)
  },
  (error: unknown) => {
    console.error(error)
    process.exit(1)
  },
)
