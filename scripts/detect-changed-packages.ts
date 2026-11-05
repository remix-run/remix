import * as cp from 'node:child_process'
import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getWorkspaceInfos,
} from './utils/workspaces.ts'

const PACKAGE_WORKSPACE_PATTERN = /^packages\/[^/]+$/

type CliOptions = {
  baseRef: string
  headRef: string
  listOnly: boolean
  scriptName: string
}

function main() {
  let options = parseArgs(process.argv.slice(2))
  let selectedPackages = getSelectedPackageNames(options)

  if (options.listOnly) {
    console.log(JSON.stringify(selectedPackages, null, 2))
    return
  }

  if (selectedPackages.length === 0) {
    console.log(
      `No affected packages with a "${options.scriptName}" script between ${options.baseRef} and ${options.headRef}. Skipping.`,
    )
    return
  }

  console.log(
    `Running ${options.scriptName} for packages changed between ${options.baseRef} and ${options.headRef}:`,
  )
  for (let packageName of selectedPackages) {
    console.log(`- ${packageName}`)
  }
  console.log()

  let args = selectedPackages.flatMap((packageName) => ['--filter', packageName])
  args.push('run', options.scriptName)

  let result = cp.spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function parseArgs(args: string[]): CliOptions {
  let baseRef = ''
  let headRef = 'HEAD'
  let listOnly = false
  let scriptName = 'test'

  for (let index = 0; index < args.length; index++) {
    let arg = args[index]
    if (arg === '--list') {
      listOnly = true
      continue
    }

    if (arg === '--script') {
      let value = args[++index]
      if (!value || value.startsWith('--')) {
        throw new Error('Expected a script name after --script')
      }
      scriptName = value
      continue
    }

    if (baseRef === '') {
      baseRef = arg
      continue
    }

    if (headRef === 'HEAD') {
      headRef = arg
      continue
    }

    throw new Error(`Unexpected argument: ${arg}`)
  }

  if (baseRef === '') {
    throw new Error(
      'Usage: node ./scripts/detect-changed-packages.ts <base-ref> [head-ref] [--list] [--script <script-name>]',
    )
  }

  return { baseRef, headRef, listOnly, scriptName }
}

function getSelectedPackageNames(options: CliOptions): string[] {
  let workspaces = getWorkspaceInfos(process.cwd())
  let changedFiles = cp
    .execFileSync('git', ['diff', '--name-only', `${options.baseRef}...${options.headRef}`], {
      encoding: 'utf8',
    })
    .split('\n')
    .filter(Boolean)
  let changedWorkspaceDirs = getChangedWorkspaceDirs(changedFiles, workspaces)
  let affectedWorkspaceDirs = getAffectedWorkspaceDirs(changedWorkspaceDirs, workspaces)

  return workspaces
    .filter(
      (workspace) =>
        PACKAGE_WORKSPACE_PATTERN.test(workspace.dir) &&
        affectedWorkspaceDirs.includes(workspace.dir) &&
        workspace.scripts.includes(options.scriptName),
    )
    .map((workspace) => workspace.name)
}

main()
