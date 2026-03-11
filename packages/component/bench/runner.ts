import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseArgs } from 'node:util'

import { chromium, type Browser, type Page } from 'playwright'

const PORT = 44100
const BASE_URL = `http://localhost:${PORT}`
const REMIX_RESULTS_FILE = path.join(import.meta.dirname, '.remix-prev-results.json')
const LAST_ARGS_FILE = path.join(import.meta.dirname, '.last-args.json')
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..')

interface SavedArgs {
  cpu: string
  runs: string
  warmups: string
  headless: boolean
  table: boolean
  profile: boolean
  framework: string[]
  benchmark: string[]
}

interface GitInfo {
  branch: string | null
  sha: string | null
}

interface BenchmarkRun {
  version: 1
  label: string
  createdAt: string
  git: GitInfo
  config: SavedArgs
  results: BenchmarkResult[]
}

function saveArgs(args: SavedArgs): void {
  fs.writeFileSync(LAST_ARGS_FILE, JSON.stringify(args, null, 2))
}

function loadLastArgs(): SavedArgs | null {
  try {
    if (fs.existsSync(LAST_ARGS_FILE)) {
      return JSON.parse(fs.readFileSync(LAST_ARGS_FILE, 'utf-8'))
    }
  } catch {
    // Ignore errors
  }
  return null
}

function runGitCommand(args: string[]): string | null {
  let result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  if (result.status !== 0) return null

  let output = result.stdout.trim()
  return output === '' ? null : output
}

function getGitInfo(): GitInfo {
  return {
    branch: runGitCommand(['branch', '--show-current']),
    sha: runGitCommand(['rev-parse', '--short', 'HEAD']),
  }
}

function getDefaultLabel(git: GitInfo): string {
  if (git.branch && git.sha) return `${git.branch} @ ${git.sha}`
  if (git.branch) return git.branch
  if (git.sha) return git.sha
  return 'current'
}

function resolveFilePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
}

let cliArgs = process.argv.slice(2)
if (cliArgs[0] === '--') {
  cliArgs = cliArgs.slice(1)
}

// Check for 'repeat' command
let isRepeat = cliArgs[0] === 'repeat'

// Parse command line arguments
let { values: args } = parseArgs({
  args: cliArgs,
  options: {
    baseline: { type: 'string' },
    cpu: { type: 'string', default: '4' },
    label: { type: 'string' },
    out: { type: 'string' },
    runs: { type: 'string', default: '5' },
    warmups: { type: 'string', default: '2' },
    headless: { type: 'boolean', default: false },
    table: { type: 'boolean', default: false },
    profile: { type: 'boolean', default: false },
    framework: {
      type: 'string',
      multiple: true,
      short: 'f',
      // default: ['remix', 'preact'],
    },
    benchmark: { type: 'string', multiple: true, short: 'b' },
  },
  allowPositionals: true,
})

// If repeating, load saved args
if (isRepeat) {
  let savedArgs = loadLastArgs()
  if (savedArgs) {
    args = { ...args, ...savedArgs }
    console.log('Repeating with saved options:', savedArgs)
  } else {
    console.error('No previous run found. Run a benchmark first.')
    process.exit(1)
  }
} else {
  // Save current args for repeat
  saveArgs({
    cpu: args.cpu!,
    runs: args.runs!,
    warmups: args.warmups!,
    headless: args.headless!,
    table: args.table!,
    profile: args.profile!,
    framework: args.framework || [],
    benchmark: args.benchmark || [],
  })
}

let cpuThrottling = parseInt(args.cpu!, 10)
let benchmarkRuns = parseInt(args.runs!, 10)
let warmupRuns = parseInt(args.warmups!, 10)
let headless = args.headless!
let useTable = args.table!
let showProfile = args.profile!
let baselineFile = args.baseline ? resolveFilePath(args.baseline) : null
let frameworkFilter = args.framework || []
let benchmarkFilter = args.benchmark || []
let outputFile = args.out ? resolveFilePath(args.out) : null
let gitInfo = getGitInfo()
let runLabel = args.label ?? getDefaultLabel(gitInfo)

interface FunctionProfile {
  name: string
  time: number
  percentage: number
}

interface TimingResult {
  scripting: number
  total: number
  profile?: FunctionProfile[]
}

interface BenchmarkResult {
  framework: string
  operation: string
  scripting: { times: number[]; mean: number; median: number; min: number; max: number }
  total: { times: number[]; mean: number; median: number; min: number; max: number }
}

interface Operation {
  name: string
  setup?: (page: Page) => Promise<void>
  action: (page: Page) => Promise<TimingResult>
  teardown?: (page: Page) => Promise<void>
}

// Dispatch a click inside the page and measure handler time plus next-paint time.
// Keeping the action in-page avoids Playwright/headless timing gaps and focuses the
// benchmark on renderer work instead of browser input dispatch overhead.
// Also captures Chrome DevTools Profiler data for detailed function-level analysis.
async function clickAndMeasure(
  page: Page,
  selector: string,
): Promise<TimingResult> {
  // Start Chrome DevTools Profiler
  let cdp = await page.context().newCDPSession(page)
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.start')

  let timing = (await page.evaluate((clickSelector) => {
    return new Promise<TimingResult>((resolve, reject) => {
      let element = document.querySelector(clickSelector)
      if (!(element instanceof Element)) {
        reject(new Error(`Selector not found: ${clickSelector}`))
        return
      }

      let start = performance.now()
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

      queueMicrotask(() => {
        let scripting = performance.now() - start
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve({
              scripting,
              total: performance.now() - start,
            })
          })
        })
      })
    })
  }, selector)) as TimingResult

  // Stop profiler and get results
  let result = await cdp.send('Profiler.stop')
  await cdp.send('Profiler.disable')

  // Process profiling data
  let profileData: FunctionProfile[] | undefined
  if (showProfile && result && result.profile) {
    let profile = result.profile as any
    let nodes = profile.nodes || []
    let samples = profile.samples || []
    let timeDeltas = profile.timeDeltas || []

    // Calculate self time for each function
    let functionTimes = new Map<number, number>()
    let functionNames = new Map<number, string>()

    // Build function name map
    for (let node of nodes) {
      let name = node.callFrame?.functionName || node.callFrame?.url || 'unknown'
      if (name.includes('node_modules')) continue // Skip node_modules
      functionNames.set(node.id, name)
    }

    // Calculate time spent in each function (self time = time when this function is on top of stack)
    let totalTime = 0
    for (let i = 0; i < samples.length; i++) {
      let sampleId = samples[i]
      let delta = timeDeltas[i] || 0
      totalTime += delta

      // Self time is when this function is the top of the stack
      let current = functionTimes.get(sampleId) || 0
      functionTimes.set(sampleId, current + delta)
    }

    // Sort by self time and get top 30
    profileData = Array.from(functionTimes.entries())
      .map(([id, time]) => ({
        name: functionNames.get(id) || 'unknown',
        time: time / 1000, // Convert to ms
        percentage: totalTime > 0 ? (time / totalTime) * 100 : 0,
      }))
      .filter((item) => !item.name.includes('node_modules'))
      .sort((a, b) => b.time - a.time)
      .slice(0, 30)
  }

  return { ...timing, profile: profileData }
}

// Wait for the main thread to be idle (no pending tasks)
async function waitForIdle(page: Page): Promise<void> {
  await page.evaluate(`
    new Promise(function(resolve) {
      // First wait for paint to complete
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          // Then wait for the main thread to be idle
          requestIdleCallback(function() {
            // Double-check with another idle callback to ensure cleanup is done
            requestIdleCallback(resolve, { timeout: 100 });
          }, { timeout: 100 });
        });
      });
    })
  `)
}

// Click without measuring (for setup/teardown)
async function click(page: Page, selector: string): Promise<void> {
  await page.evaluate((clickSelector) => {
    let element = document.querySelector(clickSelector)
    if (!(element instanceof Element)) {
      throw new Error(`Selector not found: ${clickSelector}`)
    }

    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  }, selector)
  // Wait for paint and idle to complete before continuing
  await waitForIdle(page)
}

// Clear all rows
async function clear(page: Page): Promise<void> {
  await click(page, '#clear')
}

// Create 1000 rows
async function create1k(page: Page): Promise<void> {
  await click(page, '#run')
}

// Define all benchmark operations
const operations: Operation[] = [
  {
    name: 'create1k',
    setup: clear,
    action: (page) => clickAndMeasure(page, '#run'),
  },
  // {
  //   name: 'create10k',
  //   setup: clear,
  //   action: (page) => clickAndMeasure(page, '#runlots'),
  // },
  {
    name: 'append1k',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#add'),
    teardown: clear,
  },
  {
    name: 'update',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#update'),
    teardown: clear,
  },
  {
    name: 'clear',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#clear'),
  },
  {
    name: 'swapRows',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#swaprows'),
    teardown: clear,
  },
  {
    name: 'selectRow',
    setup: create1k,
    action: (page) => clickAndMeasure(page, 'tbody tr:first-child td.col-md-4 a'),
    teardown: clear,
  },
  {
    name: 'removeRow',
    setup: create1k,
    action: (page) => clickAndMeasure(page, 'tbody tr:first-child td.col-md-1 a'),
    teardown: clear,
  },
  {
    name: 'replace1k',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#run'),
    teardown: clear,
  },
  {
    name: 'sortAsc',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#sortasc'),
    teardown: clear,
  },
  {
    name: 'sortDesc',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#sortdesc'),
    teardown: clear,
  },
  {
    name: 'switchToDashboard',
    setup: create1k,
    action: (page) => clickAndMeasure(page, '#switchToDashboard'),
    teardown: async (page) => {
      await click(page, '#switchToTable')
      await clear(page)
    },
  },
  {
    name: 'renderDashboard',
    setup: clear,
    action: (page) => clickAndMeasure(page, '#switchToDashboard'),
    teardown: async (page) => {
      await click(page, '#switchToTable')
      await clear(page)
    },
  },
  {
    name: 'teardownDashboard',
    setup: async (page) => {
      await clear(page)
      await click(page, '#switchToDashboard')
    },
    action: (page) => clickAndMeasure(page, '#switchToTable'),
    teardown: clear,
  },
  {
    name: 'sortDashboardAsc',
    setup: async (page) => {
      await clear(page)
      await click(page, '#switchToDashboard')
    },
    action: (page) => clickAndMeasure(page, '#sortDashboardAsc'),
    teardown: async (page) => {
      await click(page, '#switchToTable')
      await clear(page)
    },
  },
  {
    name: 'sortDashboardDesc',
    setup: async (page) => {
      await clear(page)
      await click(page, '#switchToDashboard')
    },
    action: (page) => clickAndMeasure(page, '#sortDashboardDesc'),
    teardown: async (page) => {
      await click(page, '#switchToTable')
      await clear(page)
    },
  },
]

// Start the benchmark server
function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    let server = spawn('tsx', ['server.ts'], {
      cwd: import.meta.dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let started = false

    server.stdout?.on('data', (data: Buffer) => {
      let output = data.toString()
      if (output.includes('Benchmark server running') && !started) {
        started = true
        resolve(server)
      }
    })

    server.stderr?.on('data', (data: Buffer) => {
      if (!started) {
        reject(new Error(`Server error: ${data.toString()}`))
      }
    })

    server.on('error', reject)

    // Timeout if server doesn't start
    setTimeout(() => {
      if (!started) {
        server.kill()
        reject(new Error('Server failed to start within timeout'))
      }
    }, 10000)
  })
}

// Stop the server
function stopServer(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    server.on('close', () => resolve())
    server.kill('SIGTERM')
  })
}

// Get list of frameworks
function getFrameworks(): string[] {
  let frameworksDir = path.join(import.meta.dirname, 'frameworks')
  let entries = fs.readdirSync(frameworksDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function saveBenchmarkRun(filePath: string, run: BenchmarkRun): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(run, null, 2))
}

function loadBenchmarkRun(filePath: string): BenchmarkRun | null {
  try {
    if (fs.existsSync(filePath)) {
      let data = fs.readFileSync(filePath, 'utf-8')
      let parsed = JSON.parse(data)

      if (Array.isArray(parsed)) {
        return {
          version: 1,
          label: 'previous',
          createdAt: '',
          git: { branch: null, sha: null },
          config: {
            cpu: '4',
            runs: '0',
            warmups: '0',
            headless: true,
            table: false,
            profile: false,
            framework: [],
            benchmark: [],
          },
          results: parsed,
        }
      }

      if (parsed && Array.isArray(parsed.results)) {
        return parsed as BenchmarkRun
      }
    }
  } catch {
    // Ignore errors loading previous results
  }

  return null
}

function createRun(
  label: string,
  git: GitInfo,
  config: SavedArgs,
  results: BenchmarkResult[],
): BenchmarkRun {
  return {
    version: 1,
    label,
    createdAt: new Date().toISOString(),
    git,
    config,
    results,
  }
}

// Save remix results to file for comparison with next run
function saveRemixResults(run: BenchmarkRun): void {
  let remixResults = run.results.filter((result) => result.framework === 'remix')
  if (remixResults.length === 0) return

  saveBenchmarkRun(REMIX_RESULTS_FILE, {
    ...run,
    results: remixResults,
  })
}

type ComparisonRun = {
  run: BenchmarkRun
  displayLabel: string
}

function loadPreviousRemixResults(): ComparisonRun | null {
  let run = loadBenchmarkRun(REMIX_RESULTS_FILE)
  if (run == null) return null

  return {
    run,
    displayLabel: 'prev',
  }
}

function getComparableResults(
  currentResults: BenchmarkResult[],
  comparisonRun: ComparisonRun,
): BenchmarkResult[] {
  let currentKeys = new Set(currentResults.map(result => `${result.framework}:${result.operation}`))

  return comparisonRun.run.results
    .filter(result => currentKeys.has(`${result.framework}:${result.operation}`))
    .map(result => ({
      ...result,
      framework: `${result.framework} (${comparisonRun.displayLabel})`,
    }))
}

function printComparisonSummary(
  currentResults: BenchmarkResult[],
  comparisonRun: ComparisonRun,
): void {
  let baselineByKey = new Map(
    comparisonRun.run.results.map(result => [`${result.framework}:${result.operation}`, result]),
  )

  let totalSummary: Record<string, Record<string, string | number>> = {}
  let scriptingSummary: Record<string, Record<string, string | number>> = {}

  for (let result of currentResults) {
    let baseline = baselineByKey.get(`${result.framework}:${result.operation}`)
    if (!baseline) continue
    if (baseline.total.median === 0 || baseline.scripting.median === 0) continue

    let rowKey = `${result.framework}/${result.operation}`
    let totalDelta = ((result.total.median - baseline.total.median) / baseline.total.median) * 100
    let scriptingDelta =
      ((result.scripting.median - baseline.scripting.median) / baseline.scripting.median) * 100

    totalSummary[rowKey] = {
      baseline: Math.round(baseline.total.median * 10) / 10,
      current: Math.round(result.total.median * 10) / 10,
      delta: `${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(1)}%`,
      ratio: `${(result.total.median / baseline.total.median).toFixed(2)}x`,
    }

    scriptingSummary[rowKey] = {
      baseline: Math.round(baseline.scripting.median * 10) / 10,
      current: Math.round(result.scripting.median * 10) / 10,
      delta: `${scriptingDelta >= 0 ? '+' : ''}${scriptingDelta.toFixed(1)}%`,
      ratio: `${(result.scripting.median / baseline.scripting.median).toFixed(2)}x`,
    }
  }

  if (Object.keys(totalSummary).length === 0) return

  let gitSuffix = comparisonRun.run.git.sha ? ` @ ${comparisonRun.run.git.sha}` : ''
  console.log(`\nComparison vs ${comparisonRun.run.label}${gitSuffix}`)
  console.log('Total Time (median ms):')
  console.table(totalSummary)
  console.log('Scripting Time (median ms):')
  console.table(scriptingSummary)
}

// Run a single operation and measure time
async function measureOperation(page: Page, operation: Operation): Promise<TimingResult> {
  // Run setup if defined
  if (operation.setup) {
    await operation.setup(page)
  }

  // Wait for idle before measuring to ensure no pending work from setup
  await waitForIdle(page)

  // Measure the action (returns timing from Event Timing API)
  let timing = await operation.action(page)

  // Run teardown if defined
  if (operation.teardown) {
    await operation.teardown(page)
  }

  // Wait for idle after teardown to ensure cleanup is complete before next operation
  await waitForIdle(page)

  return timing
}

// Calculate statistics for an array of numbers
function calcStats(times: number[]) {
  let sorted = [...times].sort((a, b) => a - b)
  return {
    times,
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

// Aggregate profiling data and calculate medians
function aggregateProfiles(
  profiles: FunctionProfile[][],
  operationName: string,
): FunctionProfile[] | null {
  if (profiles.length === 0) return null

  // Collect all function names across all runs
  let functionMap = new Map<string, number[]>()
  for (let profile of profiles) {
    for (let func of profile) {
      if (!functionMap.has(func.name)) {
        functionMap.set(func.name, [])
      }
      functionMap.get(func.name)!.push(func.time)
    }
  }

  // Calculate median time for each function
  // Also calculate average percentage across runs
  let aggregated: FunctionProfile[] = []
  for (let [name, times] of functionMap.entries()) {
    let sorted = [...times].sort((a, b) => a - b)
    let median = sorted[Math.floor(sorted.length / 2)]

    // Calculate average percentage across all runs
    let percentages: number[] = []
    for (let profile of profiles) {
      let func = profile.find((f) => f.name === name)
      if (func) {
        percentages.push(func.percentage)
      }
    }
    let avgPercentage =
      percentages.length > 0 ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0

    aggregated.push({
      name,
      time: median,
      percentage: avgPercentage,
    })
  }

  // Sort by median time and return top 30
  return aggregated.sort((a, b) => b.time - a.time).slice(0, 30)
}

// Print profiling table
function printProfileTable(profile: FunctionProfile[], operationName: string): void {
  if (profile.length === 0) return

  console.log(`\n${operationName}`)
  console.log('📊 Top functions by self time (median):')
  console.log('═'.repeat(90))
  console.log(`${'Function'.padEnd(70)} ${'Time (ms)'.padStart(10)} ${'%'.padStart(8)}`)
  console.log('─'.repeat(90))
  for (let item of profile) {
    let name = item.name.length > 68 ? '...' + item.name.slice(-65) : item.name
    console.log(
      `${name.padEnd(70)} ${item.time.toFixed(2).padStart(10)} ${item.percentage.toFixed(1).padStart(7)}%`,
    )
  }
  console.log('═'.repeat(90))
}

// Run benchmark for a single framework
async function benchmarkFramework(
  page: Page,
  framework: string,
): Promise<{ results: BenchmarkResult[]; profiles: Map<string, FunctionProfile[][]> }> {
  let results: BenchmarkResult[] = []
  let profiles = new Map<string, FunctionProfile[][]>()

  let url = `${BASE_URL}/${framework}/index.html`

  // Filter operations if benchmark filter is specified
  let filteredOperations =
    benchmarkFilter.length > 0
      ? operations.filter((op) => benchmarkFilter.some((filter) => op.name.includes(filter)))
      : operations

  for (let operation of filteredOperations) {
    let scriptingTimes: number[] = []
    let totalTimes: number[] = []
    let runProfiles: FunctionProfile[][] = []

    // Reload page before each operation to reset all JS state (idCounter, etc.)
    await page.goto(url)
    await page.waitForSelector('#run')
    await waitForIdle(page)

    // Warmup runs (not recorded)
    for (let i = 0; i < warmupRuns; i++) {
      await measureOperation(page, operation)
    }

    // Benchmark runs
    for (let i = 0; i < benchmarkRuns; i++) {
      let timing = await measureOperation(page, operation)
      scriptingTimes.push(timing.scripting)
      totalTimes.push(timing.total)
      if (showProfile && timing.profile) {
        runProfiles.push(timing.profile)
      }
    }

    results.push({
      framework,
      operation: operation.name,
      scripting: calcStats(scriptingTimes),
      total: calcStats(totalTimes),
    })

    if (showProfile && runProfiles.length > 0) {
      profiles.set(operation.name, runProfiles)
    }

    process.stdout.write('.')
  }

  return { results, profiles }
}

// ANSI color codes
const RESET = '\x1b[0m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const WHITE = '\x1b[97m'
const BG_GRAY = '\x1b[48;5;240m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

// Print combined bar graph with scripting (yellow) and total bars
function printBarGraph(allResults: BenchmarkResult[]): void {
  let operationNames = [...new Set(allResults.map((r) => r.operation))]
  let frameworks = [...new Set(allResults.map((r) => r.framework))]
  let hasRemix = frameworks.includes('remix')

  // Put remix first if it exists
  if (hasRemix) {
    frameworks = ['remix', ...frameworks.filter((f) => f !== 'remix')]
  }

  // Get terminal width (default to 100, max 120)
  let termWidth = Math.min(process.stdout.columns || 100, 120)

  // Find max framework name length for label padding
  let maxNameLen = Math.max(...frameworks.map((f) => f.length))
  let labelWidth = maxNameLen + 4 // "  name: "

  // Reserve space for label + bar + " scripting_value " + " total_value (ratio)"
  let suffixWidth = 25
  let barMaxWidth = termWidth - labelWidth - suffixWidth

  // Calculate global max value across all operations (use total since it's always >= scripting)
  let globalMax = Math.max(...allResults.map((r) => r.total.median))

  for (let opName of operationNames) {
    console.log(`${DIM}${opName}${RESET}`)

    let remixResult = hasRemix
      ? allResults.find((r) => r.framework === 'remix' && r.operation === opName)
      : null
    let remixTotal = remixResult ? remixResult.total.median : null

    for (let fw of frameworks) {
      let result = allResults.find((r) => r.framework === fw && r.operation === opName)
      let scriptingValue = result ? result.scripting.median : 0
      let totalValue = result ? result.total.median : 0
      let scriptingRounded = Math.round(scriptingValue * 10) / 10
      let totalRounded = Math.round(totalValue * 10) / 10

      // Calculate bar lengths (scaled to global max)
      let scriptingBarLen = Math.round((scriptingValue / globalMax) * barMaxWidth)
      let totalBarLen = Math.round((totalValue / globalMax) * barMaxWidth)
      let remainingBarLen = totalBarLen - scriptingBarLen

      // Build the scripting bar (yellow)
      let scriptingBar = '█'.repeat(scriptingBarLen)
      // Build the remaining bar (default color, total - scripting)
      let remainingBar = '█'.repeat(Math.max(0, remainingBarLen))

      // Scripting value with gray background and white text (fixed width for alignment)
      let scriptingText = ` ${String(scriptingRounded).padStart(5)} `

      // Build total suffix with ratio
      let totalSuffix = String(totalRounded)
      if (fw !== 'remix' && remixTotal !== null && remixTotal > 0) {
        let ratio = Math.round((totalValue / remixTotal) * 10) / 10
        let color = ratio < 1 ? RED : ratio > 1 ? GREEN : ''
        totalSuffix += ` ${color}(${ratio}x)${color ? RESET : ''}`
      }

      // Print single combined line: label + yellow bars + scripting value (gray bg) + remaining bars + total
      let label = ('  ' + fw + ':').padEnd(labelWidth)
      console.log(
        `${label}${YELLOW}${scriptingBar}${RESET}${BG_GRAY}${WHITE}${scriptingText}${RESET}${remainingBar} ${totalSuffix}`,
      )
    }
    console.log('')
  }
}

// Print results as two tables (scripting and total)
function printTable(allResults: BenchmarkResult[]): void {
  let operationNames = [...new Set(allResults.map((r) => r.operation))]
  let frameworks = [...new Set(allResults.map((r) => r.framework))]

  // Put remix first if it exists
  if (frameworks.includes('remix')) {
    frameworks = ['remix', ...frameworks.filter((f) => f !== 'remix')]
  }

  // Build scripting table with flags for slow operations
  let scriptingData: Record<string, Record<string, number>> = {}
  for (let opName of operationNames) {
    let remixResult = allResults.find((r) => r.framework === 'remix' && r.operation === opName)
    let remixValue = remixResult ? remixResult.scripting.median : 0
    let otherValues = frameworks
      .filter((fw) => fw !== 'remix')
      .map((fw) => {
        let result = allResults.find((r) => r.framework === fw && r.operation === opName)
        return result ? result.scripting.median : 0
      })
      .filter((v) => v > 0)

    // Check if remix is significantly slower (2x longer than fastest other)
    let isSlow = false
    if (remixValue && otherValues.length > 0) {
      let fastestOther = Math.min(...otherValues)
      isSlow = remixValue > fastestOther * 2.0
    }

    let displayName = isSlow ? `${opName} 🚩` : opName
    scriptingData[displayName] = {}
    for (let fw of frameworks) {
      let result = allResults.find((r) => r.framework === fw && r.operation === opName)
      scriptingData[displayName][fw] = result ? Math.round(result.scripting.median * 10) / 10 : 0
    }
  }

  // Build total table with flags for slow operations
  let totalData: Record<string, Record<string, number>> = {}
  for (let opName of operationNames) {
    let remixResult = allResults.find((r) => r.framework === 'remix' && r.operation === opName)
    let remixValue = remixResult ? remixResult.total.median : 0
    let otherValues = frameworks
      .filter((fw) => fw !== 'remix')
      .map((fw) => {
        let result = allResults.find((r) => r.framework === fw && r.operation === opName)
        return result ? result.total.median : 0
      })
      .filter((v) => v > 0)

    // Check if remix is significantly slower (>20% slower than fastest other)
    let isSlow = false
    if (remixValue && otherValues.length > 0) {
      let fastestOther = Math.min(...otherValues)
      isSlow = remixValue > fastestOther * 1.2
    }

    let displayName = isSlow ? `${opName} 🚩` : opName
    totalData[displayName] = {}
    for (let fw of frameworks) {
      let result = allResults.find((r) => r.framework === fw && r.operation === opName)
      totalData[displayName][fw] = result ? Math.round(result.total.median * 10) / 10 : 0
    }
  }

  console.log('Scripting Time (ms):')
  console.table(scriptingData)
  console.log('')
  console.log('Total Time (ms):')
  console.table(totalData)
}

// Print results as bar graphs or tables
function printResults(allResults: BenchmarkResult[]): void {
  if (useTable) {
    printTable(allResults)
  } else {
    printBarGraph(allResults)
  }
}

// Main benchmark runner
async function main(): Promise<void> {
  let server: ChildProcess | null = null
  let browser: Browser | null = null

  try {
    console.log('Starting benchmark server...')
    server = await startServer()

    console.log('Launching browser...')
    browser = await chromium.launch({ headless })
    let page = await browser.newPage()

    // Enable CPU throttling via CDP
    let client = await page.context().newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottling })

    let allFrameworks = getFrameworks()
    let frameworks = allFrameworks

    // Filter frameworks if specified
    if (frameworkFilter.length > 0) {
      let invalidFrameworks = frameworkFilter.filter((f) => !allFrameworks.includes(f))
      if (invalidFrameworks.length > 0) {
        console.error(`Error: Invalid framework(s): ${invalidFrameworks.join(', ')}`)
        console.error(`Available frameworks: ${allFrameworks.join(', ')}`)
        process.exit(1)
      }
      frameworks = frameworkFilter
    }

    let allResults: BenchmarkResult[] = []
    let allProfiles = new Map<string, FunctionProfile[][]>()

    let hasRemix = frameworks.includes('remix')
    let comparisonRun: ComparisonRun | null = null
    if (baselineFile) {
      let loadedRun = loadBenchmarkRun(baselineFile)
      if (loadedRun == null) {
        console.error(`Error: Could not load baseline file ${baselineFile}`)
        process.exit(1)
      }

      comparisonRun = {
        run: loadedRun,
        displayLabel: loadedRun.label,
      }
      console.log(`Loaded baseline results from ${baselineFile}`)
    } else if (hasRemix) {
      comparisonRun = loadPreviousRemixResults()
      if (comparisonRun != null) {
        console.log('Loaded previous remix results for comparison')
      }
    }

    console.log(`Benchmarking ${frameworks.length} frameworks: ${frameworks.join(', ')}`)
    console.log(`${warmupRuns} warmup runs, ${benchmarkRuns} benchmark runs per operation`)
    console.log(`CPU throttling: ${cpuThrottling}x`)
    console.log(`Run label: ${runLabel}`)
    console.log('')

    for (let framework of frameworks) {
      process.stdout.write(`  ${framework}: `)
      let { results, profiles } = await benchmarkFramework(page, framework)
      allResults.push(...results)
      // Store profiles keyed by framework-operation name
      for (let [operationName, runProfiles] of profiles.entries()) {
        let key = `${framework}-${operationName}`
        allProfiles.set(key, runProfiles)
      }
      console.log(' done')
    }

    let savedArgs: SavedArgs = {
      cpu: String(cpuThrottling),
      runs: String(benchmarkRuns),
      warmups: String(warmupRuns),
      headless,
      table: useTable,
      profile: showProfile,
      framework: frameworks,
      benchmark: benchmarkFilter,
    }
    let currentRun = createRun(runLabel, gitInfo, savedArgs, allResults)

    // Save current remix results for next run
    if (hasRemix) {
      saveRemixResults(currentRun)
    }

    if (outputFile) {
      saveBenchmarkRun(outputFile, currentRun)
      console.log(`Saved benchmark results to ${outputFile}`)
    }

    // Add previous remix results to display only when remix is the only framework
    // (When comparing against other frameworks, we don't need to show previous remix)
    if (comparisonRun != null && frameworks.length === 1) {
      allResults.push(...getComparableResults(currentRun.results, comparisonRun))
    }

    // Print aggregated profiling tables first
    if (showProfile && allProfiles.size > 0) {
      for (let [key, runProfiles] of allProfiles.entries()) {
        let aggregated = aggregateProfiles(runProfiles, key)
        if (aggregated) {
          printProfileTable(aggregated, key)
        }
      }
    }

    if (comparisonRun != null) {
      printComparisonSummary(currentRun.results, comparisonRun)
    }

    // Print benchmark results after profiles
    printResults(allResults)

    console.log('Benchmark complete!')
  } finally {
    console.log('Cleaning up...')
    if (browser) {
      await browser.close()
    }
    if (server) {
      await stopServer(server)
    }
  }
}

main().catch((error) => {
  console.error('Benchmark failed:', error)
  process.exit(1)
})
