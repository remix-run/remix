import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const benchDir = path.dirname(fileURLToPath(import.meta.url))
const readmePath = path.resolve(benchDir, '../README.md')
const benchmarkStart = '<!-- benchmarks:start -->'
const benchmarkEnd = '<!-- benchmarks:end -->'
const routers = ['fetch-router', 'hono']

interface VitestBenchReport {
  files: Array<{
    groups: Array<{
      fullName: string
      benchmarks: Array<{ name: string; mean: number }>
    }>
  }>
}

let tempDir = await mkdtemp(path.join(os.tmpdir(), 'fetch-router-bench-'))

try {
  let outputPath = path.join(tempDir, 'results.json')
  let result = spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'bench',
      '--run',
      'fetch-router.bench.ts',
      'hono.bench.ts',
      '--outputJson',
      outputPath,
    ],
    {
      cwd: benchDir,
      stdio: 'inherit',
    },
  )
  if (result.status !== 0) throw new Error(`vitest bench exited with code ${result.status}`)

  let report: VitestBenchReport = JSON.parse(await readFile(outputPath, 'utf8'))
  let versions = await Promise.all([
    readPackageVersion('../package.json'),
    readPackageVersion('node_modules/hono/package.json'),
  ])

  let lines = [
    `| Scenario | ${routers.map((name) => `\`${name}\``).join(' | ')} |`,
    `|---|${routers.map(() => '---:').join('|')}|`,
  ]

  // Each router runs in its own bench file, so collect results by scenario across files.
  let means = new Map<string, Map<string, number>>()
  for (let file of report.files) {
    for (let group of file.groups) {
      let scenario = group.fullName.split(' > ').at(-1)!
      let row = means.get(scenario) ?? new Map<string, number>()
      for (let benchmark of group.benchmarks) row.set(benchmark.name, benchmark.mean)
      means.set(scenario, row)
    }
  }

  for (let [scenario, row] of means) {
    let cells = routers.map((name) => {
      let mean = row.get(name)
      if (mean === undefined) throw new Error(`Missing ${name} result for ${scenario}`)
      return formatDuration(mean)
    })
    lines.push(`| ${scenario} | ${cells.join(' | ')} |`)
  }

  let tools = [
    `Node.js ${process.version}`,
    `\`fetch-router@${versions[0]}\` (\`${readCommit()}\`)`,
    `\`hono@${versions[1]}\``,
  ]
  lines.push(
    '',
    `Measured ${new Date().toISOString().slice(0, 10)} on ${os.cpus()[0]?.model ?? 'Unknown CPU'} (${os.type()} ${os.release()}) with ${new Intl.ListFormat('en-US').format(tools)}.`,
  )

  let readme = await readFile(readmePath, 'utf8')
  await writeFile(readmePath, replaceBenchmarkSection(readme, lines.join('\n')))
  console.log(`\nUpdated ${path.relative(process.cwd(), readmePath)}`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
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
