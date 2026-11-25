import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { patterns as shopifyPatterns } from './patterns/shopify.ts'

const benchDir = path.dirname(fileURLToPath(import.meta.url))
const readmePath = path.resolve(benchDir, '../README.md')
const benchmarkStart = '<!-- benchmarks:start -->'
const benchmarkEnd = '<!-- benchmarks:end -->'
const matchers = ['route-pattern', 'find-my-way', 'path-to-regexp']

interface VitestBenchReport {
  files: Array<{
    groups: Array<{
      fullName: string
      benchmarks: Array<{ name: string; mean: number }>
    }>
  }>
}

interface Scenario {
  name: string
  group: string
}

const scenarios: Scenario[] = [
  { name: '100', group: 'common patterns (100)' },
  { name: '1,000', group: 'common patterns (1000)' },
  { name: '5,000', group: 'common patterns (5000)' },
  {
    name: `${shopifyPatterns.length.toLocaleString('en-US')} (Shopify)`,
    group: 'shopify.bench.ts',
  },
]

let tempDir = await mkdtemp(path.join(os.tmpdir(), 'route-pattern-bench-'))

try {
  let outputPath = path.join(tempDir, 'results.json')
  let result = spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'bench',
      '--run',
      'src/match/common.bench.ts',
      'src/match/shopify.bench.ts',
      '--outputJson',
      outputPath,
    ],
    { cwd: benchDir, stdio: 'inherit' },
  )
  if (result.status !== 0) throw new Error(`vitest bench exited with code ${result.status}`)

  let report: VitestBenchReport = JSON.parse(await readFile(outputPath, 'utf8'))
  let means = new Map<string, number>()
  for (let file of report.files) {
    for (let group of file.groups) {
      for (let benchmark of group.benchmarks) {
        means.set(`${group.fullName} > ${benchmark.name}`, benchmark.mean)
      }
    }
  }

  let versions = await Promise.all([
    readPackageVersion('../package.json'),
    readPackageVersion('node_modules/find-my-way/package.json'),
    readPackageVersion('node_modules/path-to-regexp/package.json'),
  ])

  let lines = [
    `Last updated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Environment: ${os.type()} ${os.release()}, ${os.cpus()[0]?.model ?? 'Unknown CPU'}, Node.js ${process.version}`,
    '',
    `Versions: ${matchers.map((name, index) => `\`${name}@${versions[index]}\``).join(', ')} (\`route-pattern\` at commit \`${readCommit()}\`)`,
    '',
    '### Matching',
    '',
    'Average time to match one URL against a matcher that was built ahead of time, as in a long-running server. Lower is better.',
    '',
    ...renderTable(scenarios, (scenario, matcher) => findMean(means, scenario, 'server', matcher)),
    '',
    '### Building and matching',
    '',
    'Average time to build a matcher and match one URL, as in a cold start. Lower is better.',
    '',
    ...renderTable(scenarios, (scenario, matcher) => findMean(means, scenario, 'lambda', matcher)),
  ]

  let readme = await readFile(readmePath, 'utf8')
  await writeFile(readmePath, replaceBenchmarkSection(readme, lines.join('\n')))
  console.log(`\nUpdated ${path.relative(process.cwd(), readmePath)}`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

function findMean(
  means: Map<string, number>,
  scenario: Scenario,
  mode: 'server' | 'lambda',
  matcher: string,
): number | undefined {
  for (let [key, mean] of means) {
    if (key.includes(scenario.group) && key.endsWith(` > ${mode} > ${matcher}`)) return mean
  }
}

function renderTable(
  rows: Scenario[],
  getMean: (scenario: Scenario, matcher: string) => number | undefined,
): string[] {
  let lines = [
    `| Routes | ${matchers.map((name) => `\`${name}\``).join(' | ')} |`,
    `|---|${matchers.map(() => '---:').join('|')}|`,
  ]
  for (let scenario of rows) {
    let cells = matchers.map((matcher) => {
      let mean = getMean(scenario, matcher)
      // The Shopify patterns use syntax that find-my-way can't represent.
      return mean === undefined ? 'n/a' : formatDuration(mean)
    })
    lines.push(`| ${scenario.name} | ${cells.join(' | ')} |`)
  }
  return lines
}

function formatDuration(ms: number): string {
  let [value, unit] = ms < 0.001 ? [ms * 1e6, 'ns'] : ms < 1 ? [ms * 1e3, 'µs'] : [ms, 'ms']
  return `${value >= 100 ? Math.round(value).toLocaleString('en-US') : value.toPrecision(3)} ${unit}`
}

function readCommit(): string {
  let result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: benchDir,
    encoding: 'utf8',
  })
  return result.stdout.trim()
}

function replaceBenchmarkSection(readme: string, section: string): string {
  let startIndex = readme.indexOf(benchmarkStart)
  let endIndex = readme.indexOf(benchmarkEnd)
  if (startIndex === -1 || endIndex < startIndex) {
    throw new Error('Could not find benchmark markers in README.md')
  }
  return `${readme.slice(0, startIndex + benchmarkStart.length)}\n\n${section}\n\n${readme.slice(endIndex)}`
}

async function readPackageVersion(relativePath: string): Promise<string> {
  let packageJson = JSON.parse(await readFile(path.join(benchDir, relativePath), 'utf8'))
  return packageJson.version
}
