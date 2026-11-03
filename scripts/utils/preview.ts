import * as cp from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { formatCommand, logAndExec } from './process.ts'

export interface PreviewPackageManifest {
  name: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  scripts?: Record<string, string>
  publishConfig?: Record<string, unknown>
  [key: string]: unknown
}

export interface PreviewBuild {
  channel: string
  sha: string
  tag: string
}

export interface PreviewRelease {
  id: number
  tag_name: string
  body: string
  draft: boolean
  created_at: string
  published_at: string | null
}

export const PREVIEW_REPOSITORY = 'remix-run/previews'
export const PREVIEW_RELEASE_MARKER = '<!-- remix-preview -->'

export function getPreviewChannel(tag: string): string | null {
  return (
    /^(main|pr-[1-9]\d*|experimental-[a-zA-Z0-9][a-zA-Z0-9._-]*)-\d{8}-[a-f0-9]{8}$/.exec(
      tag,
    )?.[1] ?? null
  )
}

export function getExpiredPreviewReleases(
  releases: PreviewRelease[],
  channel: string,
  now = Date.now(),
): PreviewRelease[] {
  let builds = releases.filter((release) => {
    let releaseChannel = getPreviewChannel(release.tag_name)
    return (
      release.body.startsWith(PREVIEW_RELEASE_MARKER) &&
      (channel === 'experimental'
        ? releaseChannel?.startsWith('experimental-')
        : releaseChannel === channel)
    )
  })
  if (/^pr-[1-9]\d*$/.test(channel)) return builds
  if (channel !== 'main' && channel !== 'experimental') return []

  let latest =
    channel === 'main'
      ? builds
          .filter((release) => !release.draft)
          .toSorted(
            (a, b) =>
              Date.parse(b.published_at ?? b.created_at) -
              Date.parse(a.published_at ?? a.created_at),
          )[0]
      : undefined
  let cutoff = now - (channel === 'main' ? 7 : 30) * 24 * 60 * 60 * 1000
  return builds.filter(
    (release) =>
      release.id !== latest?.id && Date.parse(release.published_at ?? release.created_at) < cutoff,
  )
}

export function getPreviewTag(channel: string, sha: string, committedAt: string): string {
  if (!/^(main|pr-[1-9]\d*|experimental-[a-zA-Z0-9][a-zA-Z0-9._-]*)$/.test(channel)) {
    throw new Error(`Invalid preview channel: ${channel}`)
  }
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error(`Invalid source SHA: ${sha}`)
  let date = new Date(committedAt).toISOString().slice(0, 10).replaceAll('-', '')
  return `${channel}-${date}-${sha.slice(0, 8)}`
}

export function validatePreviewRepository(repository: string): string {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
    throw new Error(`Invalid preview repository: ${repository}`)
  }
  return repository
}

export function getPreviewTarballUrl(
  tag: string,
  packageDirName: string,
  repository = PREVIEW_REPOSITORY,
): string {
  validatePreviewRepository(repository)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(packageDirName)) {
    throw new Error(`Invalid package directory: ${packageDirName}`)
  }
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${packageDirName}.tgz`
}

export function parsePreviewBuild(tag: string, sha: string): PreviewBuild {
  let channel = getPreviewChannel(tag)
  if (!channel || !/^[a-f0-9]{40}$/.test(sha) || !tag.endsWith(`-${sha.slice(0, 8)}`))
    throw new Error('Invalid preview tag or source SHA')
  return { channel, sha, tag }
}

export function preparePreviewPackage(
  manifest: PreviewPackageManifest,
  tarballUrls: Map<string, string>,
): PreviewPackageManifest {
  let pkg = { ...manifest, ...manifest.publishConfig }
  delete pkg.publishConfig

  for (let field of ['dependencies', 'optionalDependencies'] as const) {
    if (!pkg[field]) continue
    pkg[field] = { ...pkg[field] }
    for (let [name, version] of Object.entries(pkg[field])) {
      let url = tarballUrls.get(name)
      if (url) {
        pkg[field][name] = url
      } else if (name.startsWith('@remix-run/') || version.startsWith('workspace:')) {
        throw new Error(`Missing preview tarball for ${name} in ${pkg.name}`)
      }
    }
  }

  if (pkg.scripts) {
    pkg.scripts = { ...pkg.scripts }
    delete pkg.scripts.prepack
    delete pkg.scripts.postpack
  }

  return pkg
}

export async function buildPreview(
  channel: string,
  directory: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<PreviewBuild> {
  let sha = logAndExec('git', ['rev-parse', 'HEAD'], true)
  let committedAt = logAndExec('git', ['show', '--no-patch', '--format=%cI', 'HEAD'], true)
  let tag = getPreviewTag(channel, sha, committedAt)
  let entries = await fsp.readdir('packages', { withFileTypes: true })
  let packages: { dirName: string; content: string; manifest: PreviewPackageManifest }[] = []
  for (let entry of entries) {
    if (!entry.isDirectory()) continue
    let content = await fsp.readFile(`packages/${entry.name}/package.json`, 'utf8')
    let manifest: PreviewPackageManifest = JSON.parse(content)
    if (!manifest.private) packages.push({ dirName: entry.name, content, manifest })
  }
  let urls = new Map(
    packages.map(({ dirName, manifest }) => [manifest.name, getPreviewTarballUrl(tag, dirName)]),
  )
  if (!urls.has('remix')) throw new Error('Missing remix package')
  function exec(command: string, args: string[]) {
    if (dryRun) console.log(`Would run: ${formatCommand(command, args)}`)
    else logAndExec(command, args)
  }
  if (!dryRun) {
    if (logAndExec('git', ['status', '--porcelain'], true))
      throw new Error('Commit or stash changes before building a preview')
    await fsp.mkdir(directory, { recursive: true })
    if ((await fsp.readdir(directory)).length)
      throw new Error(`Preview output directory is not empty: ${directory}`)
  }
  try {
    exec('pnpm', ['--filter', './packages/*', 'run', 'build'])
    for (let { manifest } of packages) {
      if (manifest.scripts?.prepack) exec('pnpm', ['--filter', manifest.name, 'run', 'prepack'])
    }
    for (let { dirName, manifest } of packages) {
      let pkg = preparePreviewPackage(manifest, urls)
      if (!dryRun)
        await fsp.writeFile(`packages/${dirName}/package.json`, JSON.stringify(pkg, null, 2) + '\n')
    }
    for (let { dirName } of packages)
      exec('pnpm', [
        '--dir',
        `packages/${dirName}`,
        'pack',
        '--out',
        path.resolve(directory, `${dirName}.tgz`),
      ])
  } finally {
    if (!dryRun) {
      for (let { dirName, content } of packages)
        await fsp.writeFile(`packages/${dirName}/package.json`, content)
    }
  }
  console.log(
    `${dryRun ? 'Would build' : 'Built'} ${tag}\nInstall after publication: pnpm add "${urls.get('remix')}"`,
  )
  return { channel, sha, tag }
}

export interface PreviewAsset {
  id: number
  name: string
  state: string
  size: number
  digest: string | null
}

export interface GitHubRunner {
  (args: string[], input?: string): string
}

export function createGitHubRunner(token?: string): GitHubRunner {
  return (args, input) =>
    cp.execFileSync('gh', args, {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
      env: token ? { ...process.env, GH_TOKEN: token } : process.env,
    })
}

export class PreviewGitHub {
  repository: string
  #run: GitHubRunner

  constructor(repository: string, run: GitHubRunner) {
    this.repository = validatePreviewRepository(repository)
    this.#run = run
  }

  api(method: string, endpoint: string, body?: Record<string, unknown>): unknown {
    let args = ['api', '--method', method, `repos/${this.repository}/${endpoint}`]
    if (body) args.push('--input', '-')
    let output = this.#run(args, body ? JSON.stringify(body) : undefined)
    return output.trim() ? JSON.parse(output) : null
  }

  listReleases(): PreviewRelease[] {
    return this.#list('releases').map(readRelease)
  }

  listAssets(release: PreviewRelease): PreviewAsset[] {
    return this.#list(`releases/${release.id}/assets`).map(readAsset)
  }

  #list(endpoint: string): unknown[] {
    let items: unknown[] = []
    for (let page = 1; ; page++) {
      let result = this.api('GET', `${endpoint}?per_page=100&page=${page}`)
      if (!Array.isArray(result)) throw new Error(`Invalid GitHub list: ${endpoint}`)
      items.push(...result)
      if (result.length < 100) return items
    }
  }

  upload(release: PreviewRelease, filename: string): void {
    this.#run([
      'release',
      'upload',
      release.tag_name,
      path.resolve(filename),
      '--repo',
      this.repository,
    ])
  }

  delete(endpoint: string): void {
    try {
      this.api('DELETE', endpoint)
    } catch (error) {
      let stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : ''
      let missingTag =
        endpoint.startsWith('git/refs/tags/') &&
        /\(HTTP 422\)/.test(stderr) &&
        /Reference does not exist/i.test(stderr)
      if (!/\(HTTP 404\)/.test(stderr) && !missingTag) throw error
    }
  }

  deleteRelease(release: PreviewRelease): void {
    // Delete the tag first so an interrupted cleanup still leaves a discoverable release.
    this.delete(`git/refs/tags/${encodeURIComponent(release.tag_name)}`)
    this.delete(`releases/${release.id}`)
  }
}

export function publishPreview(
  github: PreviewGitHub,
  build: PreviewBuild,
  directory: string,
  dryRun = false,
): string {
  let files = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => path.join(directory, entry.name))
  if (!files.includes(path.join(directory, 'remix.tgz')))
    throw new Error('Missing remix preview tarball')
  let expected = files.map((filename) => {
    let data = fs.readFileSync(filename)
    if (!data.length) throw new Error(`Empty preview asset: ${filename}`)
    return {
      name: path.basename(filename),
      size: data.length,
      digest: `sha256:${createHash('sha256').update(data).digest('hex')}`,
    }
  })
  let url = `https://github.com/${github.repository}/releases/tag/${build.tag}`
  if (dryRun) {
    console.log(
      `Would publish ${url} with assets: ${expected.map((asset) => asset.name).join(', ')}`,
    )
    return url
  }

  let release = github.listReleases().find((item) => item.tag_name === build.tag)
  let sourceRepository = validatePreviewRepository(
    process.env.GITHUB_REPOSITORY ?? 'remix-run/remix',
  )
  let repositoryUrl = `https://github.com/${sourceRepository}`
  let commitUrl = `${repositoryUrl}/commit/${build.sha}`
  let prNumber = /^pr-([1-9]\d*)$/.exec(build.channel)?.[1]
  let sourceUrl = prNumber ? `${repositoryUrl}/pull/${prNumber}/commits/${build.sha}` : commitUrl
  let source = prNumber
    ? `SHA [${build.sha.slice(0, 8)}](${sourceUrl}) in PR [#${prNumber}](${repositoryUrl}/pull/${prNumber})`
    : `[${sourceRepository}@${build.sha}](${sourceUrl})`
  if (
    release &&
    (!release.body.startsWith(PREVIEW_RELEASE_MARKER) ||
      (!release.body.includes(`](${sourceUrl})`) && !release.body.includes(`](${commitUrl})`)))
  ) {
    throw new Error(`Preview release does not match the source commit: ${build.tag}`)
  }
  if (release && !release.draft) {
    verifyAssets(github.listAssets(release), expected, false)
    console.log(`Reusing published preview: ${url}`)
    return url
  }
  if (!release) {
    release = readRelease(
      github.api('POST', 'releases', {
        tag_name: build.tag,
        name: build.tag,
        draft: true,
        prerelease: true,
        make_latest: 'false',
        body: `${PREVIEW_RELEASE_MARKER}\nBuilt from ${source}.\n\nInstall:\n\n\`\`\`sh\npnpm add "${getPreviewTarballUrl(build.tag, 'remix', github.repository)}"\n\`\`\`\n`,
      }),
    )
  }
  // Drafts may contain only part of a previous attempt or bytes from a fresh rebuild.
  for (let asset of github.listAssets(release)) github.delete(`releases/assets/${asset.id}`)
  for (let filename of files) github.upload(release, filename)
  verifyAssets(github.listAssets(release), expected, true)
  github.api('PATCH', `releases/${release.id}`, {
    draft: false,
    prerelease: true,
    make_latest: 'false',
  })
  console.log(`Published preview: ${url}`)
  return url
}

export function publishPreviewBuild(
  github: PreviewGitHub,
  build: PreviewBuild,
  directory: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): boolean {
  let prNumber = /^pr-([1-9]\d*)$/.exec(build.channel)?.[1]
  let closed = () =>
    prNumber !== undefined &&
    readPullRequest(process.env.GITHUB_REPOSITORY ?? 'remix-run/remix', Number(prNumber)).closed
  let published = false
  try {
    if (dryRun || !closed()) {
      publishPreview(github, build, directory, dryRun)
      published = true
      if (!dryRun && !prNumber)
        cleanupPreviews(github, build.channel === 'main' ? 'main' : 'experimental')
    }
  } finally {
    if (!dryRun && closed()) {
      cleanupPreviews(github, build.channel)
      published = false
    }
  }
  return published
}

export function cleanupPreviews(
  github: PreviewGitHub,
  channel: string,
  { dryRun = false, now = Date.now() }: { dryRun?: boolean; now?: number } = {},
): void {
  for (let release of getExpiredPreviewReleases(github.listReleases(), channel, now)) {
    console.log(`${dryRun ? 'Would delete' : 'Deleting'} preview: ${release.tag_name}`)
    if (!dryRun) github.deleteRelease(release)
  }
}

export function readPullRequest(
  repository: string,
  number: number,
  run = createGitHubRunner(process.env.GITHUB_TOKEN),
): { closed: boolean; sha: string } {
  validatePreviewRepository(repository)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid PR number')
  let value: unknown = JSON.parse(run(['api', `repos/${repository}/pulls/${number}`]))
  if (
    !isRecord(value) ||
    (value.state !== 'open' && value.state !== 'closed') ||
    !isRecord(value.head) ||
    typeof value.head.sha !== 'string'
  ) {
    throw new Error(`Invalid PR response: ${number}`)
  }
  return { closed: value.state === 'closed', sha: value.head.sha }
}

function verifyAssets(
  assets: PreviewAsset[],
  expected: { name: string; size: number; digest: string }[],
  compareBytes: boolean,
): void {
  if (
    assets.length !== expected.length ||
    expected.some(
      (file) =>
        !assets.some(
          (asset) =>
            asset.name === file.name &&
            asset.state === 'uploaded' &&
            asset.size > 0 &&
            (!compareBytes ||
              (asset.size === file.size &&
                (asset.digest === null || asset.digest === file.digest))),
        ),
    )
  )
    throw new Error('Preview release assets are incomplete or do not match the build')
}

function readRelease(value: unknown): PreviewRelease {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    typeof value.tag_name !== 'string' ||
    typeof value.draft !== 'boolean' ||
    typeof value.created_at !== 'string' ||
    !Number.isFinite(Date.parse(value.created_at)) ||
    !(
      value.published_at === null ||
      (typeof value.published_at === 'string' && Number.isFinite(Date.parse(value.published_at)))
    )
  ) {
    throw new Error('Invalid GitHub release')
  }
  return {
    id: value.id,
    tag_name: value.tag_name,
    body: typeof value.body === 'string' ? value.body : '',
    draft: value.draft,
    created_at: value.created_at,
    published_at: value.published_at,
  }
}

function readAsset(value: unknown): PreviewAsset {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.state !== 'string' ||
    typeof value.size !== 'number' ||
    !(value.digest == null || typeof value.digest === 'string')
  )
    throw new Error('Invalid GitHub asset')
  return {
    id: value.id,
    name: value.name,
    state: value.state,
    size: value.size,
    digest: value.digest ?? null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
