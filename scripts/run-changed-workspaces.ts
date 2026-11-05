import * as cp from 'node:child_process'
import { parseArgs as parseCliArgs } from 'node:util'
import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getFullRunReasons,
  getWorkspaceInfos,
} from './utils/workspaces.ts'

type CliOptions = {
  scriptName: string
  baseRef: string
  headRef: string
  workspaceDirs: string[]
  scriptArgs: string[]
}

function main() {
  let options = parseArgs(process.argv.slice(2))
  let workspaceInfos = getWorkspaceInfos(process.cwd())
  for (let dir of options.workspaceDirs) {
    if (!workspaceInfos.some((workspace) => workspace.dir === dir)) {
      throw new Error(`Unknown workspace: ${dir}`)
    }
  }
  let changedFiles = getChangedFiles(options.baseRef, options.headRef)
  let fullRunReasons = getFullRunReasons(changedFiles, workspaceInfos)

  if (changedFiles.length === 0) {
    console.log(
      `No changes detected between ${options.baseRef} and ${options.headRef}. Skipping ${options.scriptName}.`,
    )
    return
  }

  if (fullRunReasons.length > 0) {
    console.log(`Running full ${options.scriptName} because shared root files changed:`)
    for (let reason of fullRunReasons) {
      console.log(`- ${reason}`)
    }
    console.log()
    if (options.workspaceDirs.length === 0) {
      runRootScript(options.scriptName, options.scriptArgs)
      return
    }
  }

  let changedWorkspaceDirs = getChangedWorkspaceDirs(changedFiles, workspaceInfos)
  let affectedWorkspaceDirs =
    fullRunReasons.length > 0
      ? workspaceInfos.map((workspace) => workspace.dir)
      : getAffectedWorkspaceDirs(changedWorkspaceDirs, workspaceInfos)
  let selectedWorkspaces = workspaceInfos.filter(
    (workspace) =>
      affectedWorkspaceDirs.includes(workspace.dir) &&
      workspace.scripts.includes(options.scriptName) &&
      (options.workspaceDirs.length === 0 || options.workspaceDirs.includes(workspace.dir)),
  )

  if (selectedWorkspaces.length === 0) {
    console.log(
      `No workspaces with a "${options.scriptName}" script are affected between ${options.baseRef} and ${options.headRef}. Skipping.`,
    )
    return
  }

  console.log(
    `Running ${options.scriptName} in affected workspaces between ${options.baseRef} and ${options.headRef}:`,
  )
  for (let workspace of selectedWorkspaces) {
    console.log(`- ${workspace.dir} (${workspace.name})`)
  }
  console.log()

  runWorkspaceScript(
    options.scriptName,
    selectedWorkspaces.map((workspace) => workspace.dir),
    options.scriptArgs,
  )
}

function parseArgs(args: string[]): CliOptions {
  let normalizedArgs = args[0] === '--' ? args.slice(1) : args
  // Preserve `pnpm test:changed -- base-ref head-ref`, which presets the script name.
  if (
    normalizedArgs[1] === '--' &&
    normalizedArgs[2] != null &&
    !normalizedArgs[2].startsWith('--')
  ) {
    normalizedArgs = [normalizedArgs[0], ...normalizedArgs.slice(2)]
  }
  let separator = normalizedArgs.indexOf('--')
  let { values, positionals } = parseCliArgs({
    args: separator === -1 ? normalizedArgs : normalizedArgs.slice(0, separator),
    allowPositionals: true,
    options: { workspace: { type: 'string', multiple: true } },
  })
  let [scriptName, baseRef, headRef] = positionals

  if (scriptName == null || scriptName === '' || positionals.length > 3) {
    throw new Error(
      'Usage: node ./scripts/run-changed-workspaces.ts <script-name> [base-ref] [head-ref] [--workspace <dir>]... [-- <script-args>...]',
    )
  }

  return {
    scriptName,
    baseRef: baseRef ?? resolveDefaultBaseRef(),
    headRef: headRef ?? 'HEAD',
    workspaceDirs: values.workspace ?? [],
    scriptArgs: separator === -1 ? [] : normalizedArgs.slice(separator + 1),
  }
}

function resolveDefaultBaseRef(): string {
  for (let candidate of ['origin/main', 'main', 'HEAD~1']) {
    if (refExists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    'Could not determine a default base ref. Pass one explicitly, for example: pnpm run test:changed -- origin/main',
  )
}

function refExists(ref: string): boolean {
  let result = cp.spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    stdio: 'ignore',
  })

  return result.status === 0
}

function getChangedFiles(baseRef: string, headRef: string): string[] {
  let changedFiles = new Set<string>()

  for (let file of runGitFiles([
    'diff',
    '--name-only',
    '--no-renames',
    '-z',
    `${baseRef}...${headRef}`,
    '--',
    '.',
  ])) {
    changedFiles.add(file)
  }

  if (headRef === 'HEAD') {
    for (let file of runGitFiles([
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      'HEAD',
      '--',
      '.',
    ])) {
      changedFiles.add(file)
    }

    for (let file of runGitFiles(['ls-files', '--others', '--exclude-standard', '-z'])) {
      changedFiles.add(file)
    }
  }

  return [...changedFiles].sort()
}

function runGitFiles(args: string[]): string[] {
  let output = cp.execFileSync('git', args, { encoding: 'utf8' })

  return output.split('\0').filter(Boolean)
}

function runRootScript(scriptName: string, scriptArgs: string[]) {
  let result = cp.spawnSync('pnpm', ['run', scriptName, ...scriptArgs], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runWorkspaceScript(scriptName: string, workspaceDirs: string[], scriptArgs: string[]) {
  let args = workspaceDirs.flatMap((workspaceDir) => ['--filter', `./${workspaceDir}`])
  if (scriptName === 'test') {
    args.unshift('--recursive', '--no-sort', '--workspace-concurrency=4', '--stream')
  }
  args.push('run', scriptName, ...scriptArgs)

  let result = cp.spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

main()
