import { parseTar } from '@remix-run/tar-parser'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { gunzipSync } from 'node:zlib'

import { fetchUnavailable, projectRootNotFound, remoteSkillDataMissing } from './errors.ts'
import { runProgressStep, type StepProgressReporter } from './reporter.ts'
import {
  createSkillsCacheManifest,
  readSkillsCache,
  type SkillsCacheManifest,
  type SkillsCacheSkillEntry,
  writeSkillsCache,
} from './skills-cache.ts'

const REMIX_GITHUB_TREE_URL =
  'https://api.github.com/repos/remix-run/remix/git/trees/main?recursive=1'
const REMIX_GITHUB_ARCHIVE_URL = 'https://codeload.github.com/remix-run/remix/tar.gz/refs/heads/main'
const REMIX_SKILLS_PATH = 'skills/'

export interface SkillChange {
  action: 'add' | 'replace'
  name: string
}

export interface SkillStatusEntry {
  name: string
  state: 'installed' | 'missing' | 'outdated'
}

interface SkillsResult {
  entries: SkillStatusEntry[]
  projectRoot: string
  skillsDir: string
}

export interface SkillsOverview extends SkillsResult {}

export interface SkillsInstallResult extends SkillsResult {
  appliedChanges: SkillChange[]
}

export interface SkillsOptions {
  progress?: SkillsProgressReporter
  skillsDir?: string
}

export type SkillsInstallPhase =
  | 'resolve-project-root'
  | 'fetch-remix-skills-metadata'
  | 'read-local-skills-cache'
  | 'compare-local-skills'
  | 'download-remix-skills-archive'
  | 'write-updated-skills'

export type SkillsProgressReporter = StepProgressReporter<SkillsInstallPhase>

interface GitHubTreeEntry {
  path: string
  sha: string
  type: 'blob' | 'tree'
}

interface GitHubTreeResponse {
  tree?: unknown
  truncated?: unknown
}

interface LocalSkillSnapshot {
  exists: boolean
  fileHashes: Map<string, string>
  isDirectory: boolean
}

interface RemoteSkill {
  files: RemoteSkillFile[]
  name: string
}

interface RemoteSkillContent {
  files: RemoteSkillContentFile[]
  name: string
}

interface RemoteSkillContentFile {
  content: string
  path: string
}

interface RemoteSkillFile {
  path: string
  sha: string
}

interface SkillsPlan extends SkillsResult {
  pendingChanges: SkillChange[]
  remoteSkills: RemoteSkill[]
}

type FetchImpl = typeof fetch

export async function getSkillsOverview(
  cwd: string = process.cwd(),
  fetchImpl: FetchImpl = globalThis.fetch,
  options: SkillsOptions = {},
): Promise<SkillsOverview> {
  let plan = await loadSkillsPlan(cwd, fetchImpl, options)
  return {
    entries: plan.entries,
    projectRoot: plan.projectRoot,
    skillsDir: plan.skillsDir,
  }
}

export async function installRemixSkills(
  cwd: string = process.cwd(),
  fetchImpl: FetchImpl = globalThis.fetch,
  options: SkillsOptions = {},
): Promise<SkillsInstallResult> {
  let plan = await loadSkillsPlan(cwd, fetchImpl, options)

  if (plan.pendingChanges.length === 0) {
    options.progress?.skip('write-updated-skills', 'No changes.')
    return {
      appliedChanges: [],
      entries: plan.entries,
      projectRoot: plan.projectRoot,
      skillsDir: plan.skillsDir,
    }
  }

  let targetSkillNames = new Set(plan.pendingChanges.map((change) => change.name))
  let downloadedSkills = await runProgressStep(options.progress, 'download-remix-skills-archive', () =>
    downloadRemoteSkillsArchive(fetchImpl, plan.remoteSkills, targetSkillNames),
  )

  await runProgressStep(options.progress, 'write-updated-skills', async () => {
    await fs.mkdir(plan.skillsDir, { recursive: true })

    for (let change of plan.pendingChanges) {
      let remoteSkill = downloadedSkills.get(change.name)
      if (remoteSkill == null) {
        throw remoteSkillDataMissing(change.name)
      }

      let skillDir = path.join(plan.skillsDir, remoteSkill.name)
      await fs.rm(skillDir, { recursive: true, force: true })
      await writeRemoteSkill(skillDir, remoteSkill)
    }

    let manifest = await buildSkillsCacheManifest(plan.skillsDir, plan.remoteSkills)
    await writeSkillsCache(plan.skillsDir, manifest)
  })

  return {
    appliedChanges: plan.pendingChanges,
    entries: plan.entries,
    projectRoot: plan.projectRoot,
    skillsDir: plan.skillsDir,
  }
}

async function loadSkillsPlan(
  cwd: string,
  fetchImpl: FetchImpl,
  options: SkillsOptions = {},
): Promise<SkillsPlan> {
  if (typeof fetchImpl !== 'function') {
    throw fetchUnavailable()
  }

  let projectRoot = await runProgressStep(options.progress, 'resolve-project-root', () =>
    findProjectRoot(cwd),
  )
  let skillsDir = resolveSkillsDir(projectRoot, options.skillsDir)
  let remoteSkills = await runProgressStep(options.progress, 'fetch-remix-skills-metadata', () =>
    fetchRemoteSkills(fetchImpl),
  )
  let cacheManifest = await runProgressStep(options.progress, 'read-local-skills-cache', () =>
    readSkillsCache(skillsDir),
  )
  let entries = await runProgressStep(options.progress, 'compare-local-skills', async () =>
    Promise.all(
      remoteSkills.map(async (remoteSkill) => {
        let localSkill = await readLocalSkill(path.join(skillsDir, remoteSkill.name))
        return {
          name: remoteSkill.name,
          state: getSkillState(remoteSkill, localSkill, cacheManifest),
        } satisfies SkillStatusEntry
      }),
    ),
  )

  entries.sort((left, right) => left.name.localeCompare(right.name))

  return {
    entries,
    pendingChanges: entries
      .filter((entry) => entry.state !== 'installed')
      .map((entry) => ({
        action: entry.state === 'missing' ? 'add' : 'replace',
        name: entry.name,
      })),
    projectRoot,
    remoteSkills,
    skillsDir,
  }
}

async function fetchRemoteSkills(fetchImpl: FetchImpl): Promise<RemoteSkill[]> {
  let treeResponse = await fetchGitHubJson<GitHubTreeResponse>(
    fetchImpl,
    REMIX_GITHUB_TREE_URL,
    'Could not fetch Remix skills metadata from GitHub.',
  )

  if (treeResponse.truncated === true) {
    throw new Error('GitHub returned a truncated Remix skills listing.')
  }

  if (!Array.isArray(treeResponse.tree)) {
    throw new Error('Received an invalid Remix skills listing from GitHub.')
  }

  let groupedFiles = new Map<string, RemoteSkillFile[]>()

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
      sha: entry.sha,
    })
    groupedFiles.set(skillName, existing)
  }

  let remoteSkills = [...groupedFiles.entries()]
    .filter(([, files]) => files.some((file) => file.path === 'SKILL.md'))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([skillName, files]) => ({
      files: files.slice().sort((left, right) => left.path.localeCompare(right.path)),
      name: skillName,
    }))

  if (remoteSkills.length === 0) {
    throw new Error('Could not find any Remix skills on GitHub.')
  }

  return remoteSkills
}

async function downloadRemoteSkillsArchive(
  fetchImpl: FetchImpl,
  remoteSkills: RemoteSkill[],
  targetSkillNames: ReadonlySet<string>,
): Promise<Map<string, RemoteSkillContent>> {
  let compressedArchive = await fetchGitHubBytes(
    fetchImpl,
    REMIX_GITHUB_ARCHIVE_URL,
    'Could not download the Remix skills archive from GitHub.',
  )
  let archive = gunzipSync(compressedArchive)
  let downloadedFiles = new Map<string, Map<string, string>>()

  await parseTar(archive, async (entry) => {
    if (entry.header.type !== 'file') {
      return
    }

    let archivePath = getArchiveSkillPath(entry.name)
    if (archivePath == null) {
      return
    }

    let [skillName, ...fileParts] = archivePath.split('/')
    if (skillName == null || skillName.length === 0 || fileParts.length === 0) {
      return
    }

    if (!targetSkillNames.has(skillName)) {
      return
    }

    let files = downloadedFiles.get(skillName)
    if (files == null) {
      files = new Map<string, string>()
      downloadedFiles.set(skillName, files)
    }

    files.set(fileParts.join('/'), new TextDecoder().decode(await entry.bytes()))
  })

  let downloadedSkills = new Map<string, RemoteSkillContent>()
  for (let remoteSkill of remoteSkills) {
    if (!targetSkillNames.has(remoteSkill.name)) {
      continue
    }

    let files = downloadedFiles.get(remoteSkill.name)
    if (files == null || files.size !== remoteSkill.files.length) {
      throw new Error(
        `GitHub returned incomplete archive data for Remix skill: ${remoteSkill.name}.`,
      )
    }

    let validatedFiles = remoteSkill.files.map((file) => {
      let content = files.get(file.path)
      if (content == null) {
        throw new Error(
          `GitHub returned incomplete archive data for Remix skill file: ${remoteSkill.name}/${file.path}.`,
        )
      }

      let bytes = Buffer.from(content, 'utf8')
      if (computeGitBlobSha(bytes) !== file.sha) {
        throw new Error(
          `GitHub returned Remix skill content that did not match the metadata listing for ${remoteSkill.name}/${file.path}. Please try again.`,
        )
      }

      return {
        content,
        path: file.path,
      }
    })

    downloadedSkills.set(remoteSkill.name, {
      files: validatedFiles,
      name: remoteSkill.name,
    })
  }

  return downloadedSkills
}

async function fetchGitHubJson<T>(
  fetchImpl: FetchImpl,
  url: string,
  failureMessage: string,
): Promise<T> {
  let response = await fetchImpl(url, { headers: createGitHubHeaders() })
  if (!response.ok) {
    throw createGitHubRequestError(response, failureMessage)
  }

  return (await response.json()) as T
}

async function fetchGitHubBytes(
  fetchImpl: FetchImpl,
  url: string,
  failureMessage: string,
): Promise<Uint8Array> {
  let response = await fetchImpl(url, { headers: createGitHubHeaders() })
  if (!response.ok) {
    throw createGitHubRequestError(response, failureMessage)
  }

  return new Uint8Array(await response.arrayBuffer())
}

function createGitHubHeaders(): HeadersInit {
  let token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'User-Agent': '@remix-run/cli',
  }
}

function createGitHubRequestError(response: Response, failureMessage: string): Error {
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    let resetText = getGitHubRateLimitResetText(response)
    return new Error(
      `${failureMessage} GitHub API rate limit exceeded.${resetText} Set GITHUB_TOKEN or GH_TOKEN to use a higher authenticated GitHub rate limit.`,
    )
  }

  return new Error(`${failureMessage} ${response.status} ${response.statusText}`.trim())
}

function getGitHubRateLimitResetText(response: Response): string {
  let reset = Number(response.headers.get('x-ratelimit-reset'))
  if (!Number.isFinite(reset)) {
    return ''
  }

  return ` The rate limit resets at ${new Date(reset * 1000).toISOString()}.`
}

function isGitHubTreeEntry(value: unknown): value is GitHubTreeEntry {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof Reflect.get(value, 'path') === 'string' &&
    typeof Reflect.get(value, 'sha') === 'string' &&
    (Reflect.get(value, 'type') === 'blob' || Reflect.get(value, 'type') === 'tree')
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
        fileHashes: new Map(),
        isDirectory: false,
      }
    }

    return {
      exists: true,
      fileHashes: await readLocalFiles(skillDir),
      isDirectory: true,
    }
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return {
        exists: false,
        fileHashes: new Map(),
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
      for (let [nestedPath, hash] of nestedFiles) {
        files.set(nestedPath, hash)
      }
      continue
    }

    if (entry.isFile()) {
      files.set(relativePath, computeLocalContentHash(await fs.readFile(entryPath)))
      continue
    }

    files.set(relativePath, '')
  }

  return files
}

function getSkillState(
  remoteSkill: RemoteSkill,
  localSkill: LocalSkillSnapshot,
  cacheManifest: SkillsCacheManifest | null,
): SkillStatusEntry['state'] {
  if (!localSkill.exists) {
    return 'missing'
  }

  if (!localSkill.isDirectory) {
    return 'outdated'
  }

  let cachedSkill = cacheManifest?.skills[remoteSkill.name]
  if (cachedSkill == null) {
    return 'outdated'
  }

  let cachedFiles = new Map(Object.entries(cachedSkill.files))
  if (
    localSkill.fileHashes.size !== remoteSkill.files.length ||
    cachedFiles.size !== remoteSkill.files.length
  ) {
    return 'outdated'
  }

  for (let file of remoteSkill.files) {
    let localHash = localSkill.fileHashes.get(file.path)
    let cachedFile = cachedFiles.get(file.path)

    if (
      localHash == null ||
      cachedFile == null ||
      cachedFile.localHash !== localHash ||
      cachedFile.remoteSha !== file.sha
    ) {
      return 'outdated'
    }
  }

  return 'installed'
}

async function buildSkillsCacheManifest(
  skillsDir: string,
  remoteSkills: RemoteSkill[],
): Promise<SkillsCacheManifest> {
  let cachedSkills: Record<string, SkillsCacheSkillEntry> = {}

  for (let remoteSkill of remoteSkills) {
    let localSkill = await readLocalSkill(path.join(skillsDir, remoteSkill.name))
    if (!localSkill.exists || !localSkill.isDirectory) {
      throw remoteSkillDataMissing(remoteSkill.name)
    }

    let cachedFiles: SkillsCacheSkillEntry['files'] = {}
    for (let file of remoteSkill.files) {
      let localHash = localSkill.fileHashes.get(file.path)
      if (localHash == null) {
        throw new Error(
          `Installed Remix skill is missing file data for ${remoteSkill.name}/${file.path}.`,
        )
      }

      cachedFiles[file.path] = {
        localHash,
        remoteSha: file.sha,
      }
    }

    cachedSkills[remoteSkill.name] = {
      files: cachedFiles,
    }
  }

  return createSkillsCacheManifest(skillsDir, cachedSkills)
}

async function writeRemoteSkill(skillDir: string, remoteSkill: RemoteSkillContent): Promise<void> {
  await fs.mkdir(skillDir, { recursive: true })

  for (let file of remoteSkill.files) {
    let filePath = path.join(skillDir, file.path)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, file.content, 'utf8')
  }
}

function getArchiveSkillPath(entryName: string): string | null {
  let marker = `/${REMIX_SKILLS_PATH}`
  let markerIndex = entryName.indexOf(marker)
  if (markerIndex === -1) {
    return null
  }

  return entryName.slice(markerIndex + marker.length)
}

function computeLocalContentHash(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function computeGitBlobSha(bytes: Uint8Array): string {
  return crypto
    .createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}
