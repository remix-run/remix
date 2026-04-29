import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const benchDir = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(benchDir, '..')
const readmePath = path.join(packageDir, 'README.md')
const packageJsonPath = path.join(packageDir, 'package.json')
const expressPackageJsonPath = path.join(benchDir, 'node_modules/express/package.json')

const benchmarkStart = '<!-- benchmarks:start -->'
const benchmarkEnd = '<!-- benchmarks:end -->'

let threads = getEnv('BENCH_THREADS', '12')
let connections = getEnv('BENCH_CONNECTIONS', '400')
let duration = getEnv('BENCH_DURATION', '30s')
let port = getEnv('BENCH_PORT', '3000')
let startDelayMs = Number(getEnv('BENCH_START_DELAY_MS', '2000'))

interface Benchmark {
  name: string
  version: string
  server: string
}

interface BenchmarkGroup {
  name: string
  description: string
  wrkScript?: string
  benchmarks: Benchmark[]
}

interface BenchmarkResult extends Benchmark {
  requestsPerSecond: string
  averageLatency: string
  transferPerSecond: string
}

interface BenchmarkGroupResult {
  name: string
  description: string
  results: BenchmarkResult[]
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error)
  process.exitCode = 1
})

async function main(): Promise<void> {
  let nodeFetchServerVersion = await readPackageVersion(packageJsonPath)
  let expressVersion = await readPackageVersion(expressPackageJsonPath)
  let nodeVersion = process.version.slice(1)

  let groups: BenchmarkGroup[] = [
    {
      name: 'Raw Throughput',
      description: 'Simple HTML response benchmarks without inspecting the incoming request.',
      benchmarks: [
        { name: 'node:http', version: nodeVersion, server: './servers/node-http.ts' },
        {
          name: 'node-fetch-server',
          version: nodeFetchServerVersion,
          server: './servers/node-fetch-server.ts',
        },
        {
          name: 'node-fetch-server-uws',
          version: nodeFetchServerVersion,
          server: './servers/node-fetch-server-uws.ts',
        },
        { name: 'express', version: expressVersion, server: './servers/express.ts' },
      ],
    },
    {
      name: 'Request Inspection',
      description: 'POST benchmarks that read the request method, headers, and body.',
      wrkScript: './request-inspection.lua',
      benchmarks: [
        {
          name: 'node:http-request-inspection',
          version: nodeVersion,
          server: './servers/node-http-request-inspection.ts',
        },
        {
          name: 'node-fetch-server-request-inspection',
          version: nodeFetchServerVersion,
          server: './servers/node-fetch-server-request-inspection.ts',
        },
        {
          name: 'node-fetch-server-uws-request-inspection',
          version: nodeFetchServerVersion,
          server: './servers/node-fetch-server-uws-request-inspection.ts',
        },
        {
          name: 'express-request-inspection',
          version: expressVersion,
          server: './servers/express-request-inspection.ts',
        },
      ],
    },
  ]

  let results: BenchmarkGroupResult[] = []

  for (let group of groups) {
    let groupResults: BenchmarkResult[] = []
    console.log(`\n${group.name}`)

    for (let benchmark of group.benchmarks) {
      console.log(`Running ${benchmark.name}@${benchmark.version} ...`)
      groupResults.push(await runBenchmark(benchmark, group))
    }

    results.push({ name: group.name, description: group.description, results: groupResults })
  }

  let readme = await readFile(readmePath, 'utf8')
  let updatedReadme = replaceBenchmarkSection(readme, renderBenchmarkSection(results))
  await writeFile(readmePath, updatedReadme)
  console.log(`\nUpdated ${path.relative(process.cwd(), readmePath)}`)
}

async function runBenchmark(
  benchmark: Benchmark,
  group: BenchmarkGroup,
): Promise<BenchmarkResult> {
  let server = spawn(process.execPath, [benchmark.server], {
    cwd: benchDir,
    env: { ...process.env, PORT: port },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  let serverExit = waitForExit(server)

  try {
    await delay(startDelayMs)

    if (server.exitCode != null) {
      throw new Error(`${benchmark.name} exited before wrk started with code ${server.exitCode}`)
    }

    let wrkArgs = [`-t${threads}`, `-c${connections}`, `-d${duration}`]
    if (group.wrkScript != null) wrkArgs.push('-s', group.wrkScript)
    wrkArgs.push(`http://127.0.0.1:${port}/`)

    let output = await runCommand('wrk', wrkArgs, benchDir)
    let wrk = parseWrkOutput(output.stdout)

    return {
      ...benchmark,
      ...wrk,
    }
  } finally {
    server.kill('SIGINT')
    await Promise.race([
      serverExit,
      delay(5000).then(() => {
        if (server.exitCode == null) server.kill('SIGTERM')
      }),
    ])
  }
}

function parseWrkOutput(output: string): Omit<
  BenchmarkResult,
  'name' | 'version' | 'server'
> {
  return {
    requestsPerSecond: readMatch(output, /Requests\/sec:\s+([0-9.]+)/, 'Requests/sec'),
    averageLatency: readMatch(output, /Latency\s+([^\s]+)/, 'Latency'),
    transferPerSecond: readMatch(output, /Transfer\/sec:\s+([^\n]+)/, 'Transfer/sec'),
  }
}

function renderBenchmarkSection(groups: BenchmarkGroupResult[]): string {
  let cpu = os.cpus()[0]?.model ?? 'Unknown CPU'
  let command = `wrk -t${threads} -c${connections} -d${duration}`
  let lines = [
    `Last updated: ${new Date().toISOString()}`,
    '',
    `Environment: ${os.type()} ${os.release()}, ${cpu}, Node.js ${process.version}`,
    '',
    `Command: \`${command}\``,
    '',
  ]

  for (let group of groups) {
    lines.push(`### ${group.name}`)
    lines.push('')
    lines.push(group.description)
    lines.push('')
    lines.push('| Server | Version | Requests/sec | Avg latency | Transfer/sec |')
    lines.push('|---|---:|---:|---:|---:|')

    for (let result of sortBenchmarkResults(group.results)) {
      lines.push(
        `| \`${result.name}\` | \`${result.version}\` | \`${formatNumber(result.requestsPerSecond)}\` | \`${result.averageLatency}\` | \`${result.transferPerSecond.trim()}\` |`,
      )
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

function sortBenchmarkResults(results: BenchmarkResult[]): BenchmarkResult[] {
  return [...results].sort(
    (left, right) =>
      parseRequestsPerSecond(right.requestsPerSecond) -
      parseRequestsPerSecond(left.requestsPerSecond),
  )
}

function parseRequestsPerSecond(value: string): number {
  return Number(value.replaceAll(',', ''))
}

function replaceBenchmarkSection(readme: string, section: string): string {
  let startIndex = readme.indexOf(benchmarkStart)
  let endIndex = readme.indexOf(benchmarkEnd)

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('Could not find benchmark markers in README.md')
  }

  return [
    readme.slice(0, startIndex + benchmarkStart.length),
    '\n',
    section,
    '\n',
    readme.slice(endIndex),
  ].join('')
}

async function readPackageVersion(packageJsonPath: string): Promise<string> {
  let packageJson: unknown = JSON.parse(await readFile(packageJsonPath, 'utf8'))

  if (!isRecord(packageJson) || typeof packageJson.version !== 'string') {
    throw new Error(`${packageJsonPath} does not contain a string version`)
  }

  return packageJson.version
}

function readMatch(output: string, pattern: RegExp, label: string): string {
  let match = pattern.exec(output)
  let value = match?.[1]

  if (value == null) {
    throw new Error(`Could not parse ${label} from wrk output:\n${output}`)
  }

  return value
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}\n${stderr}`))
      }
    })
  })
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code))
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function formatNumber(value: string): string {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getEnv(name: string, defaultValue: string): string {
  let value = process.env[name]
  return value == null || value === '' ? defaultValue : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
