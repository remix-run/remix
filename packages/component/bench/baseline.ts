#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import * as path from 'node:path'
import { parseArgs } from 'node:util'

type GitInfo = {
  branch: string | null
  sha: string | null
}

function runGitCommand(args: string[]): string | null {
  let result = spawnSync('git', args, {
    cwd: path.resolve(import.meta.dirname, '..', '..', '..'),
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
  if (git.branch && git.sha) return `${git.branch}-${git.sha}`
  if (git.branch) return git.branch
  if (git.sha) return git.sha
  return 'benchmark'
}

function sanitizeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function resolvePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
}

function run(command: string, args: string[]): void {
  let result = spawnSync(command, args, {
    cwd: import.meta.dirname,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

let cliArgs = process.argv.slice(2)
if (cliArgs[0] === '--') {
  cliArgs = cliArgs.slice(1)
}

let { values: args } = parseArgs({
  args: cliArgs,
  options: {
    baseline: { type: 'string' },
    cpu: { type: 'string', default: '4' },
    framework: { type: 'string', multiple: true },
    benchmark: { type: 'string', multiple: true },
    label: { type: 'string' },
    out: { type: 'string' },
    profile: { type: 'boolean', default: false },
    runs: { type: 'string', default: '20' },
    'skip-build': { type: 'boolean', default: false },
    warmups: { type: 'string', default: '5' },
  },
  allowPositionals: true,
})

let git = getGitInfo()
let label = args.label ?? getDefaultLabel(git)
let frameworks = args.framework && args.framework.length > 0 ? args.framework : ['remix']
let resultsDir = path.join(import.meta.dirname, 'results')
let outputFile = args.out
  ? resolvePath(args.out)
  : path.join(resultsDir, `${createTimestamp()}-${sanitizeFilePart(label)}.json`)

if (!args['skip-build']) {
  console.log('Building benchmark frameworks...')
  run('pnpm', ['run', 'build-frameworks'])
}

let runnerArgs = [
  'run',
  'bench',
  '--',
  '--cpu',
  args.cpu!,
  '--runs',
  args.runs!,
  '--warmups',
  args.warmups!,
  '--headless',
  '--table',
  '--label',
  label,
  '--out',
  outputFile,
]

if (args.profile) {
  runnerArgs.push('--profile')
}

if (args.baseline) {
  runnerArgs.push('--baseline', resolvePath(args.baseline))
}

for (let framework of frameworks) {
  runnerArgs.push('--framework', framework)
}

for (let benchmark of args.benchmark ?? []) {
  runnerArgs.push('--benchmark', benchmark)
}

console.log(`Running benchmark label: ${label}`)
console.log(`Writing results to: ${outputFile}`)

if (args.baseline) {
  console.log(`Comparing against baseline: ${resolvePath(args.baseline)}`)
}

run('pnpm', runnerArgs)

console.log('\nNext step:')
if (args.baseline) {
  console.log(`  Inspect ${outputFile} and compare it against ${resolvePath(args.baseline)}`)
} else {
  console.log(`  Use this baseline later with: pnpm run baseline -- --baseline ${outputFile} --label <new-label>`)
}
