import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'

import { fetchUnavailable, projectRootNotFound, remoteSkillDataMissing } from './errors.ts'
import { runProgressStep, type StepProgressReporter } from './progress.ts'

const REMIX_GITHUB_TREE_URL =
  'https://api.github.com/repos/remix-run/remix/git/trees/main?recursive=1'
const REMIX_SKILLS_PATH = 'skills/'

export interface SkillChange {
  action: 'add' | 'replace'
  name: string
}

export interface SkillStatusEntry {
  name: string
  state: 'installed' | 'missing' | 'outdated'
}

export interface SkillsOverview {
  changes: SkillChange[]
  entries: SkillStatusEntry[]
  projectRoot: string
  skillsDir: string
}

export interface SkillsInstallResult extends SkillsOverview {
  appliedChanges: SkillChange[]
}

export interface SkillsInstallOptions {
  progress?: SkillsProgressReporter
  skillsDir?: string
}

export interface SkillsOverviewOptions {
  skillsDir?: string
}

export type SkillsInstallPhase =
  | 'resolve-project-root'
  | 'fetch-remix-skills'
  | 'compare-local-skills'
  | 'write-updated-skills'

export type SkillsProgressReporter = StepProgressReporter<SkillsInstallPhase>

interface GitHubBlobResponse {
  content?: unknown
  encoding?: unknown
}

interface GitHubTreeEntry {
  path: string
  type: 'blob' | 'tree'
  url: string
}

interface GitHubTreeResponse {
  tree?: unknown
  truncated?: unknown
}

interface LocalSkillSnapshot {
  exists: boolean
  files: Map<string, string>
  isDirectory: boolean
}

interface RemoteSkill {
  files: RemoteSkillFile[]
  name: string
}

interface RemoteSkillFile {
  content: string
  path: string
}

interface SkillsPlan extends SkillsOverview {
  remoteSkills: RemoteSkill[]
}

type FetchImpl = typeof fetch

export async function getSkillsOverview(
  cwd: string = process.cwd(),
  fetchImpl: FetchImpl = globalThis.fetch,
  options: SkillsOverviewOptions = {},
): Promise<SkillsOverview> {
  let plan = await loadSkillsPlan(cwd, fetchImpl, options)
  return {
    changes: plan.changes,
    entries: plan.entries,
    projectRoot: plan.projectRoot,
    skillsDir: plan.skillsDir,
  }
}

export async function installRemixSkills(
  cwd: string = process.cwd(),
  fetchImpl: FetchImpl = globalThis.fetch,
  options: SkillsInstallOptions = {},
): Promise<SkillsInstallResult> {
  let plan = await loadSkillsPlan(cwd, fetchImpl, options)

  if (plan.changes.length === 0) {
    options.progress?.skip('write-updated-skills', 'No changes.')
    return {
      appliedChanges: plan.changes,
      changes: plan.changes,
      entries: plan.entries,
      projectRoot: plan.projectRoot,
      skillsDir: plan.skillsDir,
    }
  }

  await runProgressStep(options.progress, 'write-updated-skills', async () => {
    await fs.mkdir(plan.skillsDir, { recursive: true })
    for (let change of plan.changes) {
      let remoteSkill = plan.remoteSkills.find((skill) => skill.name === change.name)
      if (remoteSkill == null) {
        throw remoteSkillDataMissing(change.name)
      }

      let skillDir = path.join(plan.skillsDir, remoteSkill.name)
      await fs.rm(skillDir, { recursive: true, force: true })
      await writeRemoteSkill(skillDir, remoteSkill)
    }
  })

  return {
    appliedChanges: plan.changes,
    changes: plan.changes,
    entries: plan.entries,
    projectRoot: plan.projectRoot,
    skillsDir: plan.skillsDir,
  }
}

async function loadSkillsPlan(
  cwd: string,
  fetchImpl: FetchImpl,
  options: SkillsInstallOptions = {},
): Promise<SkillsPlan> {
  if (typeof fetchImpl !== 'function') {
    throw fetchUnavailable()
  }

  let projectRoot = await runProgressStep(options.progress, 'resolve-project-root', () =>
    findProjectRoot(cwd),
  )
  let skillsDir = resolveSkillsDir(projectRoot, options.skillsDir)
  let remoteSkills = await runProgressStep(options.progress, 'fetch-remix-skills', () =>
    fetchRemoteSkills(fetchImpl),
  )
  let entries = await runProgressStep(options.progress, 'compare-local-skills', async () =>
    Promise.all(
      remoteSkills.map(async (remoteSkill) => {
        let localSkill = await readLocalSkill(path.join(skillsDir, remoteSkill.name))
        return {
          name: remoteSkill.name,
          state: getSkillState(remoteSkill, localSkill),
        } satisfies SkillStatusEntry
      }),
    ),
  )

  entries.sort((left, right) => left.name.localeCompare(right.name))

  return {
    changes: entries
      .filter((entry) => entry.state !== 'installed')
      .map((entry) => ({
        action: entry.state === 'missing' ? 'add' : 'replace',
        name: entry.name,
      })),
    entries,
    projectRoot,
    remoteSkills,
    skillsDir,
  }
}

async function fetchRemoteSkills(fetchImpl: FetchImpl): Promise<RemoteSkill[]> {
  let treeResponse = await fetchGitHubJson<GitHubTreeResponse>(
    fetchImpl,
    REMIX_GITHUB_TREE_URL,
    'Could not fetch Remix skills from GitHub.',
  )

  if (treeResponse.truncated === true) {
    throw new Error('GitHub returned a truncated Remix skills listing.')
  }

  if (!Array.isArray(treeResponse.tree)) {
    throw new Error('Received an invalid Remix skills listing from GitHub.')
  }

  let groupedFiles = new Map<string, GitHubTreeEntry[]>()

  for (let entry of treeResponse.tree) {
    if (!isGitHubTreeEntry(entry)) {
      continue
    }

    if (entry.type !== 'blob' || !entry.path.startsWith(REMIX_SKILLS_PATH)) {
      continue
    }

    let pathParts = entry.path.split('/')
    if (pathParts.length < 3) {
      continue
    }

    let skillName = pathParts[1]
    if (skillName.length === 0) {
      continue
    }

    let existing = groupedFiles.get(skillName) ?? []
    existing.push({
      path: pathParts.slice(2).join('/'),
      type: entry.type,
      url: entry.url,
    })
    groupedFiles.set(skillName, existing)
  }

  let remoteSkills = await Promise.all(
    [...groupedFiles.entries()]
      .filter(([, files]) => files.some((file) => file.path === 'SKILL.md'))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(async ([skillName, files]) => ({
        files: await Promise.all(
          files
            .slice()
            .sort((left, right) => left.path.localeCompare(right.path))
            .map(async (file) => ({
              content: await fetchGitHubBlob(fetchImpl, file.url, file.path),
              path: file.path,
            })),
        ),
        name: skillName,
      })),
  )

  if (remoteSkills.length === 0) {
    throw new Error('Could not find any Remix skills on GitHub.')
  }

  return remoteSkills
}

async function fetchGitHubJson<T>(
  fetchImpl: FetchImpl,
  url: string,
  failureMessage: string,
): Promise<T> {
  let response = await fetchImpl(url, { headers: createGitHubHeaders() })
  if (!response.ok) {
    throw new Error(`${failureMessage} ${response.status} ${response.statusText}`.trim())
  }

  return (await response.json()) as T
}

async function fetchGitHubBlob(
  fetchImpl: FetchImpl,
  url: string,
  filePath: string,
): Promise<string> {
  let blobResponse = await fetchGitHubJson<GitHubBlobResponse>(
    fetchImpl,
    url,
    `Could not download Remix skill file from GitHub: ${filePath}.`,
  )

  if (blobResponse.encoding !== 'base64' || typeof blobResponse.content !== 'string') {
    throw new Error(`Received invalid content for Remix skill file from GitHub: ${filePath}.`)
  }

  return Buffer.from(blobResponse.content, 'base64').toString('utf8')
}

function createGitHubHeaders(): HeadersInit {
  let token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'User-Agent': '@remix-run/cli',
  }
}

function isGitHubTreeEntry(value: unknown): value is GitHubTreeEntry {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof Reflect.get(value, 'path') === 'string' &&
    (Reflect.get(value, 'type') === 'blob' || Reflect.get(value, 'type') === 'tree') &&
    typeof Reflect.get(value, 'url') === 'string'
  )
}

async function findProjectRoot(startDir: string): Promise<string> {
  let currentDir = path.resolve(startDir)

  while (true) {
    if (
      (await pathExists(path.join(currentDir, 'package.json'))) ||
      (await pathExists(path.join(currentDir, '.agents'))) ||
      (await pathExists(path.join(currentDir, '.git')))
    ) {
      return currentDir
    }

    let parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  throw projectRootNotFound(startDir)
}

function resolveSkillsDir(projectRoot: string, skillsDir: string | undefined): string {
  if (skillsDir == null || skillsDir.length === 0) {
    return path.join(projectRoot, '.agents', 'skills')
  }

  if (path.isAbsolute(skillsDir)) {
    return skillsDir
  }

  return path.resolve(projectRoot, skillsDir)
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

async function readLocalSkill(skillDir: string): Promise<LocalSkillSnapshot> {
  try {
    let stats = await fs.stat(skillDir)
    if (!stats.isDirectory()) {
      return {
        exists: true,
        files: new Map(),
        isDirectory: false,
      }
    }

    return {
      exists: true,
      files: await readLocalFiles(skillDir),
      isDirectory: true,
    }
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return {
        exists: false,
        files: new Map(),
        isDirectory: false,
      }
    }

    throw error
  }
}

async function readLocalFiles(
  rootDir: string,
  relativeDir: string = '',
): Promise<Map<string, string>> {
  let files = new Map<string, string>()
  let dirPath = relativeDir.length === 0 ? rootDir : path.join(rootDir, relativeDir)
  let entries = await fs.readdir(dirPath, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (let entry of entries) {
    let relativePath = relativeDir.length === 0 ? entry.name : `${relativeDir}/${entry.name}`
    let entryPath = path.join(rootDir, relativePath)

    if (entry.isDirectory()) {
      let nestedFiles = await readLocalFiles(rootDir, relativePath)
      for (let [nestedPath, content] of nestedFiles) {
        files.set(nestedPath, content)
      }
      continue
    }

    if (entry.isFile()) {
      files.set(relativePath, await fs.readFile(entryPath, 'utf8'))
      continue
    }

    files.set(relativePath, '')
  }

  return files
}

function getSkillState(
  remoteSkill: RemoteSkill,
  localSkill: LocalSkillSnapshot,
): SkillStatusEntry['state'] {
  if (!localSkill.exists) {
    return 'missing'
  }

  if (!localSkill.isDirectory || localSkill.files.size !== remoteSkill.files.length) {
    return 'outdated'
  }

  for (let file of remoteSkill.files) {
    if (localSkill.files.get(file.path) !== file.content) {
      return 'outdated'
    }
  }

  return 'installed'
}

async function writeRemoteSkill(skillDir: string, remoteSkill: RemoteSkill): Promise<void> {
  await fs.mkdir(skillDir, { recursive: true })

  for (let file of remoteSkill.files) {
    let filePath = path.join(skillDir, file.path)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, file.content, 'utf8')
  }
}
