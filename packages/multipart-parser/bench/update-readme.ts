import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const benchDir = path.dirname(fileURLToPath(import.meta.url))
const readmePath = path.resolve(benchDir, '../README.md')
const benchmarkStart = '<!-- benchmarks:start -->'
const benchmarkEnd = '<!-- benchmarks:end -->'

const runtimeCommands = [
  ['node', 'runner.ts', '--json'],
  ['bun', 'run', 'runner.ts', '--json'],
]

interface RunnerOutput {
  runtime: string
  results: Record<string, Record<string, string>>
}

let lines: string[] = []

for (let command of runtimeCommands) {
  console.log(`Running benchmarks with ${command.join(' ')} ...`)
  let result = spawnSync(command[0], command.slice(1), {
    cwd: benchDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) throw new Error(`${command.join(' ')} exited with code ${result.status}`)

  let output: RunnerOutput = JSON.parse(result.stdout.trim().split('\n').at(-1)!)
  let parsers = Object.keys(output.results)
  let benchmarks = Object.keys(output.results[parsers[0]])

  lines.push(`### ${output.runtime}`, '')
  lines.push(`| Message | ${parsers.map((parser) => `\`${parser}\``).join(' | ')} |`)
  lines.push(`|---|${parsers.map(() => '---:').join('|')}|`)
  for (let benchmark of benchmarks) {
    let cells = parsers.map((parser) => output.results[parser][benchmark])
    lines.push(`| ${benchmark} | ${cells.join(' | ')} |`)
  }
  lines.push('')
}

let [multipartParser, ...otherParsers] = await readVersions()
let tools = [`${multipartParser} (\`${readCommit()}\`)`, ...otherParsers]
lines.push(
  `Measured ${new Date().toISOString().slice(0, 10)} on ${os.cpus()[0]?.model ?? 'Unknown CPU'} (${os.type()} ${os.release()}) with ${new Intl.ListFormat('en-US').format(tools)}.`,
)

let readme = await readFile(readmePath, 'utf8')
await writeFile(readmePath, replaceBenchmarkSection(readme, lines.join('\n')))
console.log(`\nUpdated ${path.relative(process.cwd(), readmePath)}`)

async function readVersions(): Promise<string[]> {
  let packages = [
    ['multipart-parser', '../package.json'],
    ['multipasta', 'node_modules/multipasta/package.json'],
    ['busboy', 'node_modules/busboy/package.json'],
    ['@fastify/busboy', 'node_modules/@fastify/busboy/package.json'],
  ]
  return Promise.all(
    packages.map(async ([name, relativePath]) => {
      let packageJson = JSON.parse(await readFile(path.join(benchDir, relativePath), 'utf8'))
      return `\`${name}@${packageJson.version}\``
    }),
  )
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
