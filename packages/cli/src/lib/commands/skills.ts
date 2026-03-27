import * as process from 'node:process'

import { UsageError } from '../errors.ts'
import { getSkillsOverview, installRemixSkills } from '../skills.ts'

export async function runSkillsCommand(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(getSkillsCommandHelpText())
    return 0
  }

  let [subcommand, ...rest] = argv

  try {
    if (subcommand === 'install') {
      return runSkillsInstallCommand(rest)
    }

    if (subcommand === 'list') {
      return runSkillsListCommand(rest)
    }

    if (subcommand === 'status') {
      return runSkillsStatusCommand(rest)
    }

    throw new UsageError(`Unknown skills command: ${subcommand}`)
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getSkillsCommandHelpText())
      return 1
    }

    throw error
  }
}

export function getSkillsCommandHelpText(): string {
  return `Usage:
  remix skills <command>

Manage Remix skills for the current project.

Commands:
  install [--dir <path>]  Install Remix skills into .agents/skills or a custom directory
  list [--dir <path>] [--json]     List available Remix skills and local state
  status [--dir <path>] [--json]   Show what remix skills install would change

Examples:
  remix skills install
  remix skills install --dir custom/skills
  remix skills list --dir custom/skills
  remix skills list --json
  remix skills status --dir custom/skills
  remix skills status --json
`
}

export function getSkillsInstallCommandHelpText(): string {
  return `Usage:
  remix skills install [--dir <path>]

Install or refresh Remix skills in .agents/skills for the current project.

Options:
  --dir <path>  Install skills into a custom directory relative to the project root

Examples:
  remix skills install
  remix skills install --dir custom/skills
`
}

export function getSkillsListCommandHelpText(): string {
  return `Usage:
  remix skills list [--dir <path>] [--json]

List Remix skills from GitHub and show their local state.

Options:
  --dir <path>  Read local skills from a custom directory relative to the project root
  --json        Print skill state as JSON

Examples:
  remix skills list
  remix skills list --dir custom/skills
  remix skills list --json
`
}

export function getSkillsStatusCommandHelpText(): string {
  return `Usage:
  remix skills status [--dir <path>] [--json]

Show what remix skills install would add or replace.

Options:
  --dir <path>  Read local skills from a custom directory relative to the project root
  --json        Print pending changes as JSON

Examples:
  remix skills status
  remix skills status --dir custom/skills
  remix skills status --json
`
}

async function runSkillsInstallCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getSkillsInstallCommandHelpText())
    return 0
  }

  let options: { dir: string | null }
  try {
    options = parseSkillsInstallCommandArgs(argv)
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getSkillsInstallCommandHelpText())
      return 1
    }

    throw error
  }

  return runSkillsAction([], getSkillsInstallCommandHelpText(), async () => {
    let result = await installRemixSkills(process.cwd(), globalThis.fetch, {
      skillsDir: options.dir ?? undefined,
    })
    if (result.appliedChanges.length === 0) {
      process.stdout.write(`No changes. ${result.skillsDir} is up to date.\n`)
      return 0
    }

    process.stdout.write(`Synced Remix skills into ${result.skillsDir}:\n`)
    for (let change of result.appliedChanges) {
      process.stdout.write(`${toPastTense(change.action)} ${change.name}\n`)
    }
    return 0
  })
}

async function runSkillsListCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getSkillsListCommandHelpText())
    return 0
  }

  let options: { dir: string | null; json: boolean }
  try {
    options = parseSkillsDirArgs(argv, { allowJson: true })
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getSkillsListCommandHelpText())
      return 1
    }

    throw error
  }

  return runSkillsAction([], getSkillsListCommandHelpText(), async () => {
    let result = await getSkillsOverview(process.cwd(), globalThis.fetch, {
      skillsDir: options.dir ?? undefined,
    })
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            entries: result.entries,
            projectRoot: result.projectRoot,
            skillsDir: result.skillsDir,
          },
          null,
          2,
        )}\n`,
      )
      return 0
    }

    process.stdout.write(`Remix skills in ${result.skillsDir}:\n`)
    for (let entry of result.entries) {
      process.stdout.write(`${entry.state} ${entry.name}\n`)
    }
    return 0
  })
}

async function runSkillsStatusCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getSkillsStatusCommandHelpText())
    return 0
  }

  let options: { dir: string | null; json: boolean }
  try {
    options = parseSkillsDirArgs(argv, { allowJson: true })
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getSkillsStatusCommandHelpText())
      return 1
    }

    throw error
  }

  return runSkillsAction([], getSkillsStatusCommandHelpText(), async () => {
    let result = await getSkillsOverview(process.cwd(), globalThis.fetch, {
      skillsDir: options.dir ?? undefined,
    })
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            changes: result.changes,
            projectRoot: result.projectRoot,
            skillsDir: result.skillsDir,
          },
          null,
          2,
        )}\n`,
      )
      return 0
    }

    if (result.changes.length === 0) {
      process.stdout.write(`No changes. ${result.skillsDir} is up to date.\n`)
      return 0
    }

    process.stdout.write(`Remix skills to sync into ${result.skillsDir}:\n`)
    for (let change of result.changes) {
      process.stdout.write(`${change.action} ${change.name}\n`)
    }
    return 0
  })
}

async function runSkillsAction(
  argv: string[],
  helpText: string,
  callback: () => Promise<number>,
): Promise<number> {
  try {
    ensureNoExtraArgs(argv)
    return await callback()
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(helpText)
      return 1
    }

    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`)
      return 1
    }

    throw error
  }
}

function ensureNoExtraArgs(argv: string[]): void {
  if (argv.length === 0) {
    return
  }

  let [arg] = argv
  if (arg.startsWith('-')) {
    throw new UsageError(`Unknown argument: ${arg}`)
  }

  throw new UsageError(`Unexpected extra argument: ${arg}`)
}

function parseSkillsInstallCommandArgs(argv: string[]): { dir: string | null } {
  let { dir } = parseSkillsDirArgs(argv)
  return { dir }
}

function parseSkillsDirArgs(
  argv: string[],
  options: { allowJson?: boolean } = {},
): { dir: string | null; json: boolean } {
  let dir: string | null = null
  let json = false
  let index = 0

  while (index < argv.length) {
    let arg = argv[index]

    if (arg === '--dir') {
      let next = argv[index + 1]
      if (!next) {
        throw new UsageError('--dir requires a value.')
      }

      dir = next
      index += 2
      continue
    }

    if (arg === '--json' && options.allowJson) {
      json = true
      index += 1
      continue
    }

    if (arg.startsWith('-')) {
      throw new UsageError(`Unknown argument: ${arg}`)
    }

    throw new UsageError(`Unexpected extra argument: ${arg}`)
  }

  return { dir, json }
}

function toPastTense(action: 'add' | 'replace'): string {
  return action === 'add' ? 'added' : 'replaced'
}
