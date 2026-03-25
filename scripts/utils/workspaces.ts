import * as fs from 'node:fs'
import * as path from 'node:path'

export type WorkspaceInfo = {
  dir: string
  name: string
  dependencies: string[]
  scripts: string[]
}

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules'])
const ROOT_FULL_RUN_FILES = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
const ROOT_TSCONFIG_PATTERN = /^tsconfig(?:\..+)?\.json$/

export function getWorkspaceInfos(rootDir: string): WorkspaceInfo[] {
  let packageJsonPaths = findWorkspacePackageJsonPaths(rootDir)
  let workspaces: WorkspaceInfo[] = []

  for (let packageJsonPath of packageJsonPaths) {
    let workspace = parseWorkspaceInfo(rootDir, packageJsonPath)
    if (workspace != null) {
      workspaces.push(workspace)
    }
  }

  workspaces.sort((a, b) => a.dir.localeCompare(b.dir))

  return workspaces
}

export function getChangedWorkspaceDirs(
  changedFiles: string[],
  workspaces: WorkspaceInfo[],
): Set<string> {
  let changedWorkspaceDirs = new Set<string>()
  let workspacesBySpecificity = [...workspaces].sort((a, b) => b.dir.length - a.dir.length)

  for (let file of changedFiles) {
    let workspace = findOwningWorkspace(file, workspacesBySpecificity)
    if (workspace != null) {
      changedWorkspaceDirs.add(workspace.dir)
    }
  }

  return changedWorkspaceDirs
}

export function getAffectedWorkspaceDirs(
  changedWorkspaceDirs: Set<string>,
  workspaces: WorkspaceInfo[],
): string[] {
  if (changedWorkspaceDirs.size === 0) {
    return []
  }

  let workspacesByDir = new Map(workspaces.map((workspace) => [workspace.dir, workspace]))
  let workspacesByName = new Map<string, WorkspaceInfo[]>()

  for (let workspace of workspaces) {
    let entries = workspacesByName.get(workspace.name) ?? []
    entries.push(workspace)
    workspacesByName.set(workspace.name, entries)
  }

  let reverseDependencies = new Map<string, Set<string>>()

  for (let workspace of workspaces) {
    reverseDependencies.set(workspace.dir, new Set())
  }

  for (let workspace of workspaces) {
    for (let dependencyName of workspace.dependencies) {
      for (let dependencyWorkspace of workspacesByName.get(dependencyName) ?? []) {
        reverseDependencies.get(dependencyWorkspace.dir)?.add(workspace.dir)
      }
    }
  }

  let affectedWorkspaceDirs = new Set(changedWorkspaceDirs)
  let queue = [...changedWorkspaceDirs]

  while (queue.length > 0) {
    let workspaceDir = queue.shift()
    if (workspaceDir == null) {
      continue
    }

    for (let dependentDir of reverseDependencies.get(workspaceDir) ?? []) {
      if (affectedWorkspaceDirs.has(dependentDir)) {
        continue
      }

      affectedWorkspaceDirs.add(dependentDir)
      queue.push(dependentDir)
    }
  }

  return workspaces
    .map((workspace) => workspace.dir)
    .filter(
      (workspaceDir) =>
        affectedWorkspaceDirs.has(workspaceDir) && workspacesByDir.has(workspaceDir),
    )
    .sort((a, b) => a.localeCompare(b))
}

export function getFullRunReasons(changedFiles: string[], workspaces: WorkspaceInfo[]): string[] {
  let workspacesBySpecificity = [...workspaces].sort((a, b) => b.dir.length - a.dir.length)
  let reasons: string[] = []

  for (let file of changedFiles) {
    if (ROOT_FULL_RUN_FILES.has(file) || ROOT_TSCONFIG_PATTERN.test(file)) {
      reasons.push(file)
      continue
    }

    if (!file.endsWith('/package.json')) {
      continue
    }

    if (findOwningWorkspace(file, workspacesBySpecificity) == null) {
      reasons.push(file)
    }
  }

  return [...new Set(reasons)]
}

function findWorkspacePackageJsonPaths(rootDir: string): string[] {
  let packageJsonPaths: string[] = []

  visitDirectory(rootDir, rootDir, packageJsonPaths)

  return packageJsonPaths
}

function visitDirectory(rootDir: string, currentDir: string, packageJsonPaths: string[]) {
  for (let entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }

      visitDirectory(rootDir, path.join(currentDir, entry.name), packageJsonPaths)
      continue
    }

    if (!entry.isFile() || entry.name !== 'package.json') {
      continue
    }

    packageJsonPaths.push(path.join(currentDir, entry.name))
  }
}

function parseWorkspaceInfo(rootDir: string, packageJsonPath: string): WorkspaceInfo | null {
  let workspaceDir = toPosixPath(path.relative(rootDir, path.dirname(packageJsonPath)))

  if (workspaceDir === '') {
    return null
  }

  let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    name?: string
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }

  if (typeof packageJson.name !== 'string') {
    return null
  }

  let dependencyNames = new Set<string>()

  for (let field of [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.optionalDependencies,
    packageJson.peerDependencies,
  ]) {
    for (let dependencyName of Object.keys(field ?? {})) {
      dependencyNames.add(dependencyName)
    }
  }

  return {
    dir: workspaceDir,
    name: packageJson.name,
    dependencies: [...dependencyNames],
    scripts: Object.keys(packageJson.scripts ?? {}).sort(),
  }
}

function findOwningWorkspace(file: string, workspaces: WorkspaceInfo[]): WorkspaceInfo | null {
  for (let workspace of workspaces) {
    if (file === workspace.dir || file.startsWith(`${workspace.dir}/`)) {
      return workspace
    }
  }

  return null
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}
