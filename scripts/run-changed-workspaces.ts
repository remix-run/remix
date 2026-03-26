import * as cp from 'node:child_process'
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
}

function main() {
  let options = parseArgs(process.argv.slice(2))
  let workspaceInfos = getWorkspaceInfos(process.cwd())
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
    runRootScript(options.scriptName)
    return
  }

  let changedWorkspaceDirs = getChangedWorkspaceDirs(changedFiles, workspaceInfos)
  let affectedWorkspaceDirs = getAffectedWorkspaceDirs(changedWorkspaceDirs, workspaceInfos)
  let selectedWorkspaces = workspaceInfos.filter(
    (workspace) =>
      affectedWorkspaceDirs.includes(workspace.dir) &&
      workspace.scripts.includes(options.scriptName),
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
  )
}

function parseArgs(args: string[]): CliOptions {
  let normalizedArgs = args.filter((arg) => arg !== '--')
  let [scriptName, baseRef, headRef] = normalizedArgs

  if (scriptName == null || scriptName === '') {
    throw new Error(
      'Usage: node ./scripts/run-changed-workspaces.ts <script-name> [base-ref] [head-ref]',
    )
  }

  return {
    scriptName,
    baseRef: baseRef ?? resolveDefaultBaseRef(),
    headRef: headRef ?? 'HEAD',
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

  for (let file of runGitLines(['diff', '--name-only', `${baseRef}...${headRef}`, '--', '.'])) {
    changedFiles.add(file)
  }

  if (headRef === 'HEAD') {
    for (let file of runGitLines(['diff', '--name-only', 'HEAD', '--', '.'])) {
      changedFiles.add(file)
    }

    for (let file of runGitLines(['ls-files', '--others', '--exclude-standard'])) {
      changedFiles.add(file)
    }
  }

  return [...changedFiles].sort()
}

function runGitLines(args: string[]): string[] {
  let output = cp.execFileSync('git', args, { encoding: 'utf8' })

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function runRootScript(scriptName: string) {
  let result = cp.spawnSync('pnpm', ['run', scriptName], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runWorkspaceScript(scriptName: string, workspaceDirs: string[]) {
  let args = workspaceDirs.flatMap((workspaceDir) => ['--filter', `./${workspaceDir}`])
  args.push('run', scriptName)

  let result = cp.spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

main()
