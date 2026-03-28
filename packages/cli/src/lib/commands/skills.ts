import * as process from 'node:process'

import { getDisplayPath } from '../display-path.ts'
import {
  missingOptionValue,
  renderCliError,
  toCliError,
  unknownArgument,
  unknownSkillsCommand,
  unexpectedExtraArgument,
} from '../errors.ts'
import type { SkillsInstallPhase, SkillsProgressReporter } from '../skills.ts'
import { getSkillsOverview, installRemixSkills } from '../skills.ts'
import {
  createCommandReporter,
  createStepProgressReporter,
  type CommandReporter,
} from '../reporter.ts'

const SKILLS_INSTALL_PROGRESS_LABELS = {
  'compare-local-skills': 'Compare local skills',
  'fetch-remix-skills': 'Fetch Remix skills from GitHub',
  'resolve-project-root': 'Resolve project root',
  'write-updated-skills': 'Write updated skills',
} satisfies Record<SkillsInstallPhase, string>

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

    throw unknownSkillsCommand(subcommand)
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getSkillsCommandHelpText() }),
    )
    return 1
  }
}

export function getSkillsCommandHelpText(): string {
  return `Usage:
  remix skills <command>

Manage Remix skills for the current project.

Commands:
  install [--dir <path>]           Install Remix skills into a local directory
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

List installed Remix skills and show their local state.

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
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getSkillsInstallCommandHelpText() }),
    )
    return 1
  }

  let reporter = createCommandReporter()
  let progress = createSkillsInstallProgressReporter(reporter)
  let cwd = process.cwd()

  try {
    await reporter.status.commandHeader('skills install')
    let result = await installRemixSkills(cwd, globalThis.fetch, {
      progress,
      skillsDir: options.dir ?? undefined,
    })
    let skillsDir = getDisplayPath(result.skillsDir, cwd)
    progress.writeSummaryGap()
    if (result.appliedChanges.length === 0) {
      reporter.out.line(`No changes. ${skillsDir} is up to date.`)
      return 0
    }

    reporter.out.line(`Synced Remix skills into ${skillsDir}:`)
    reporter.out.bullets(formatAppliedChanges(result.appliedChanges))
    return 0
  } catch (error) {
    progress.writeSummaryGap()
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getSkillsInstallCommandHelpText() }),
    )
    return 1
  }
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
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getSkillsListCommandHelpText() }),
    )
    return 1
  }

  let cwd = process.cwd()
  let reporter = createCommandReporter()

  return runSkillsAction([], getSkillsListCommandHelpText(), async () => {
    let result = await getSkillsOverview(cwd, globalThis.fetch, {
      skillsDir: options.dir ?? undefined,
    })
    let entries = result.entries.filter((entry) => entry.state !== 'missing')

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            entries,
            projectRoot: result.projectRoot,
            skillsDir: result.skillsDir,
          },
          null,
          2,
        )}\n`,
      )
      return 0
    }

    reporter.out.line(`Remix skills in ${getDisplayPath(result.skillsDir, cwd)}:`)
    reporter.out.bullets(entries.map((entry) => `${entry.state} ${entry.name}`))
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
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getSkillsStatusCommandHelpText() }),
    )
    return 1
  }

  let cwd = process.cwd()
  let reporter = createCommandReporter()

  return runSkillsAction([], getSkillsStatusCommandHelpText(), async () => {
    let result = await getSkillsOverview(cwd, globalThis.fetch, {
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
      reporter.out.line(`No changes. ${getDisplayPath(result.skillsDir, cwd)} is up to date.`)
      return 0
    }

    reporter.out.line(`Remix skills to sync into ${getDisplayPath(result.skillsDir, cwd)}:`)
    reporter.out.bullets(result.changes.map((change) => `${change.action} ${change.name}`))
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
    process.stderr.write(renderCliError(toCliError(error), { helpText }))
    return 1
  }
}

function ensureNoExtraArgs(argv: string[]): void {
  if (argv.length === 0) {
    return
  }

  let [arg] = argv
  if (arg.startsWith('-')) {
    throw unknownArgument(arg)
  }

  throw unexpectedExtraArgument(arg)
}

function createSkillsInstallProgressReporter(reporter: CommandReporter): SkillsProgressReporter {
  return createStepProgressReporter(reporter.status, SKILLS_INSTALL_PROGRESS_LABELS)
}

function formatAppliedChanges(
  changes: Array<{ action: 'add' | 'replace'; name: string }>,
): string[] {
  let showAction = changes.some((change) => change.action !== 'add')
  return changes.map((change) =>
    showAction ? `${toPastTense(change.action)} ${change.name}` : change.name,
  )
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
        throw missingOptionValue('--dir')
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
      throw unknownArgument(arg)
    }

    throw unexpectedExtraArgument(arg)
  }

  return { dir, json }
}

function toPastTense(action: 'add' | 'replace'): string {
  return action === 'add' ? 'added' : 'replaced'
}
