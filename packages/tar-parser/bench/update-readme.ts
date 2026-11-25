import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const benchDir = path.dirname(fileURLToPath(import.meta.url))
const readmePath = path.resolve(benchDir, '../README.md')
const benchmarkStart = '<!-- benchmarks:start -->'
const benchmarkEnd = '<!-- benchmarks:end -->'

interface RunnerOutput {
  runtime: string
  results: Record<string, Record<string, string>>
}

console.log('Running benchmarks ...')
let result = spawnSync(process.execPath, ['runner.ts', '--json'], {
  cwd: benchDir,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
})
if (result.status !== 0) throw new Error(`runner.ts exited with code ${result.status}`)

let output: RunnerOutput = JSON.parse(result.stdout.trim().split('\n').at(-1)!)
let parsers = Object.keys(output.results)
let archives = Object.keys(output.results[parsers[0]])

let lines = [
  `Last updated: ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Environment: ${os.type()} ${os.release()}, ${os.cpus()[0]?.model ?? 'Unknown CPU'}, ${output.runtime}`,
  '',
  `Versions: ${(await readVersions()).join(', ')} (\`tar-parser\` at commit \`${readCommit()}\`)`,
  '',
  `| Archive | ${parsers.map((parser) => `\`${parser}\``).join(' | ')} |`,
  `|---|${parsers.map(() => '---:').join('|')}|`,
  ...archives.map(
    (archive) =>
      `| ${archive} | ${parsers.map((parser) => output.results[parser][archive]).join(' | ')} |`,
  ),
]

let readme = await readFile(readmePath, 'utf8')
await writeFile(readmePath, replaceBenchmarkSection(readme, lines.join('\n')))
console.log(`\nUpdated ${path.relative(process.cwd(), readmePath)}`)

async function readVersions(): Promise<string[]> {
  let packages = [
    ['tar-parser', '../package.json'],
    ['tar-stream', 'node_modules/tar-stream/package.json'],
    ['tar', 'node_modules/tar/package.json'],
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
