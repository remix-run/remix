#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import * as process from 'node:process'

type ParsedArgs = {
  dryRun: boolean
  newPr: string
  oldPr: string
  repo: string | null
}

function main(): void {
  let parsed = parseArgs(process.argv.slice(2))
  ensureNumericPrNumber(parsed.oldPr, 'old_pr')
  ensureNumericPrNumber(parsed.newPr, 'new_pr')

  if (parsed.oldPr === parsed.newPr) {
    fail('old_pr and new_pr must be different.')
  }

  let repo =
    parsed.repo ?? ghCapture(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])
  let oldState = ghCapture([
    'pr',
    'view',
    parsed.oldPr,
    '--repo',
    repo,
    '--json',
    'state',
    '-q',
    '.state',
  ])
  let newState = ghCapture([
    'pr',
    'view',
    parsed.newPr,
    '--repo',
    repo,
    '--json',
    'state',
    '-q',
    '.state',
  ])

  if (newState !== 'OPEN' && newState !== 'MERGED') {
    fail(`Replacement PR #${parsed.newPr} is in state '${newState}'. Expected OPEN or MERGED.`)
  }

  if (oldState !== 'OPEN') {
    process.stdout.write(`Superseded PR #${parsed.oldPr} is already ${oldState}. Nothing to do.\n`)
    return
  }

  let comment = `Superseded by #${parsed.newPr}.`

  process.stdout.write(`Repo: ${repo}\n`)
  process.stdout.write(`Closing PR #${parsed.oldPr} with comment: ${comment}\n`)

  if (parsed.dryRun) {
    process.stdout.write(
      `[dry-run] gh pr close "${parsed.oldPr}" --repo "${repo}" --comment "${comment}"\n`,
    )
    return
  }

  ghInherit(['pr', 'close', parsed.oldPr, '--repo', repo, '--comment', comment])

  let finalState = ghCapture([
    'pr',
    'view',
    parsed.oldPr,
    '--repo',
    repo,
    '--json',
    'state',
    '-q',
    '.state',
  ])
  if (finalState !== 'CLOSED') {
    fail(`Failed to close PR #${parsed.oldPr}. Final state: ${finalState}`)
  }

  process.stdout.write(`Closed PR #${parsed.oldPr} successfully.\n`)
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes('-h') || argv.includes('--help')) {
    printUsage()
    process.exit(0)
  }

  if (argv.length < 2) {
    printUsage()
    process.exit(1)
  }

  let oldPr = argv[0]
  let newPr = argv[1]
  let repo: string | null = null
  let dryRun = false
  let index = 2

  while (index < argv.length) {
    let arg = argv[index]
    if (arg === '--repo') {
      let next = argv[index + 1]
      if (!next) {
        fail('--repo requires a value like owner/repo')
      }
      repo = next
      index += 2
      continue
    }
    if (arg === '--dry-run') {
      dryRun = true
      index++
      continue
    }
    fail(`Unknown argument: ${arg}`)
  }

  return { dryRun, newPr, oldPr, repo }
}

function printUsage(): void {
  process.stdout.write(`Usage:
  close_superseded_pr.ts <old_pr> <new_pr> [--repo <owner/repo>] [--dry-run]

Examples:
  close_superseded_pr.ts 11085 11087
  close_superseded_pr.ts 11085 11087 --repo remix-run/remix
  close_superseded_pr.ts 11085 11087 --dry-run
`)
}

function ensureNumericPrNumber(value: string, label: string): void {
  if (!/^[0-9]+$/.test(value)) {
    fail(`${label} must be a numeric pull request number.`)
  }
}

function ghCapture(args: string[]): string {
  let result = spawnSync('gh', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    let stderr = (result.stderr ?? '').trim()
    let details = stderr ? `\n${stderr}` : ''
    fail(`gh ${args.join(' ')} failed.${details}`)
  }
  return (result.stdout ?? '').trim()
}

function ghInherit(args: string[]): void {
  let result = spawnSync('gh', args, { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`gh ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`)
  }
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

main()
