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
const PR_BUILD_COMPLETE = 'Complete preview build'
const SHARED_PR_TAG = /(?:^|-)pr-[1-9]\d*$/

export function getPreviewChannel(tag: string): string | null {
  if (/^pr-[1-9]\d*$/.test(tag)) return tag
  let match =
    /^v0\.[1-9]\d{7}\.(?:0|[1-9]\d{0,5})-(?:(main|experimental)-[a-f0-9]{8}|(pr-[1-9]\d*))$/.exec(
      tag,
    )
  if (match) return match[1] ?? match[2]
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
        ? releaseChannel === 'experimental' || releaseChannel?.startsWith('experimental-')
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

export function getPreviewTag(channel: string, sha: string, timestamp: string): string {
  if (!/^(main|pr-[1-9]\d*|experimental)$/.test(channel)) {
    throw new Error(`Invalid preview channel: ${channel}`)
  }
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error(`Invalid source SHA: ${sha}`)
  let utc = new Date(timestamp).toISOString()
  let date = utc.slice(0, 10).replaceAll('-', '')
  let time = Number(utc.slice(11, 19).replaceAll(':', ''))
  let suffix = channel.startsWith('pr-') ? channel : `${channel}-${sha.slice(0, 8)}`
  return `v0.${date}.${time}-${suffix}`
}

export function getPreviewReleaseTitle(
  build: PreviewBuild,
  pr?: { headRef: string; title: string },
): string {
  if (build.channel.startsWith('pr-')) {
    let version = pr?.headRef === 'release-pr/main' ? /^Release v(\S+)$/.exec(pr.title)?.[1] : null
    return version ? `Remix ${version} preview` : `PR #${build.channel.slice(3)}`
  }
  return `${build.channel} (${build.sha.slice(0, 8)})`
}

function getPreviewTagTime(tag: string): number {
  let match = /^v0\.(\d{8})\.(\d{1,6})-/.exec(tag)
  return match ? Number(match[1]) * 1_000_000 + Number(match[2]) : 0
}

export function validatePreviewRepository(repository: string): string {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
    throw new Error(`Invalid preview repository: ${repository}`)
  }
  return repository
}

export function getPreviewTarballUrl(
  build: PreviewBuild,
  packageDirName: string,
  repository = PREVIEW_REPOSITORY,
): string {
  validatePreviewRepository(repository)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(packageDirName)) {
    throw new Error(`Invalid package directory: ${packageDirName}`)
  }
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(build.tag)}/${getPreviewAssetName(build, packageDirName)}`
}

function getPreviewAssetName(build: PreviewBuild, packageDirName: string): string {
  return SHARED_PR_TAG.test(build.tag)
    ? `${packageDirName}-${build.sha.slice(0, 8)}.tgz`
    : `${packageDirName}.tgz`
}

export function parsePreviewBuild(tag: string, sha: string): PreviewBuild {
  let channel = getPreviewChannel(tag)
  if (
    !channel ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    (!SHARED_PR_TAG.test(tag) && !tag.endsWith(`-${sha.slice(0, 8)}`))
  )
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
  let prNumber = /^pr-([1-9]\d*)$/.exec(channel)?.[1]
  let timestamp = prNumber
    ? readPullRequest(process.env.GITHUB_REPOSITORY ?? 'remix-run/remix', Number(prNumber))
        .createdAt
    : logAndExec('git', ['show', '--no-patch', '--format=%cI', 'HEAD'], true)
  let tag = getPreviewTag(channel, sha, timestamp)
  let build = { channel, sha, tag }
  let entries = await fsp.readdir('packages', { withFileTypes: true })
  let packages: { dirName: string; content: string; manifest: PreviewPackageManifest }[] = []
  for (let entry of entries) {
    if (!entry.isDirectory()) continue
    let content = await fsp.readFile(`packages/${entry.name}/package.json`, 'utf8')
    let manifest: PreviewPackageManifest = JSON.parse(content)
    if (!manifest.private) packages.push({ dirName: entry.name, content, manifest })
  }
  let urls = new Map(
    packages.map(({ dirName, manifest }) => [manifest.name, getPreviewTarballUrl(build, dirName)]),
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
        path.resolve(directory, getPreviewAssetName(build, dirName)),
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
  label: string | null
  updated_at: string
}

function getCompletedPrPreviewBuilds(
  assets: PreviewAsset[],
): { sha: string; asset: PreviewAsset }[] {
  return assets
    .flatMap((asset) => {
      let sha = /^Complete preview build: ([a-f0-9]{40})$/.exec(asset.label ?? '')?.[1]
      return sha &&
        asset.name === `remix-${sha.slice(0, 8)}.tgz` &&
        asset.state === 'uploaded' &&
        asset.size > 0
        ? [{ sha, asset }]
        : []
    })
    .toSorted(
      (a, b) =>
        Date.parse(b.asset.updated_at) - Date.parse(a.asset.updated_at) || b.asset.id - a.asset.id,
    )
}

export function getExpiredPrPreviewAssets(assets: PreviewAsset[]): PreviewAsset[] {
  let retained = new Set(
    getCompletedPrPreviewBuilds(assets)
      .slice(0, 10)
      .map((build) => build.sha.slice(0, 8)),
  )
  return assets.filter((asset) => {
    let sha = /-([a-f0-9]{8})\.tgz$/.exec(asset.name)?.[1]
    return sha !== undefined && !retained.has(sha)
  })
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
      let missingRef =
        endpoint.startsWith('git/refs/') &&
        /\(HTTP 422\)/.test(stderr) &&
        /Reference does not exist/i.test(stderr)
      if (!/\(HTTP 404\)/.test(stderr) && !missingRef) throw error
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
  if (!files.includes(path.join(directory, getPreviewAssetName(build, 'remix'))))
    throw new Error('Missing remix preview tarball')
  if (
    SHARED_PR_TAG.test(build.tag) &&
    files.some((filename) => !filename.endsWith(`-${build.sha.slice(0, 8)}.tgz`))
  )
    throw new Error('Preview tarballs do not match the source SHA')
  if (build.channel === 'main') {
    // Lets `releases/latest/download/remix.url` resolve to a lockfile-safe, SHA-specific URL.
    let filename = path.join(directory, 'remix.url')
    fs.writeFileSync(filename, `${getPreviewTarballUrl(build, 'remix', github.repository)}\n`)
    files.push(filename)
  }
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
  let title = getPreviewReleaseTitle(build)
  if (dryRun) {
    console.log(
      `Would publish ${url} as "${title}" with assets: ${expected.map((asset) => asset.name).join(', ')}`,
    )
    return url
  }

  let release = github.listReleases().find((item) => item.tag_name === build.tag)
  let sourceRepository = validatePreviewRepository(
    process.env.GITHUB_REPOSITORY ?? 'remix-run/remix',
  )
  let repositoryUrl = `https://github.com/${sourceRepository}`
  if (SHARED_PR_TAG.test(build.tag)) {
    title = getPreviewReleaseTitle(
      build,
      readPullRequest(sourceRepository, Number(build.channel.slice(3))),
    )
    return publishPrPreview(github, build, release, files, expected, repositoryUrl, title)
  }
  let commitUrl = `${repositoryUrl}/commit/${build.sha}`
  let prNumber = /^pr-([1-9]\d*)$/.exec(build.channel)?.[1]
  let sourceUrl = prNumber ? `${repositoryUrl}/pull/${prNumber}/commits/${build.sha}` : commitUrl
  let shaLink = `[${build.sha.slice(0, 8)}](${sourceUrl})`
  let source = `Experimental build from sha ${shaLink}`
  if (build.channel === 'main') {
    source = `Built from the \`main\` branch at sha ${shaLink}`
  } else if (prNumber) {
    source = `Built from SHA ${shaLink} in PR [#${prNumber}](${repositoryUrl}/pull/${prNumber})`
  }
  if (
    release &&
    (!release.body.startsWith(PREVIEW_RELEASE_MARKER) ||
      (!release.body.includes(`](${sourceUrl})`) && !release.body.includes(`](${commitUrl})`)))
  ) {
    throw new Error(`Preview release does not match the source commit: ${build.tag}`)
  }
  if (release && !release.draft) {
    verifyAssets(github.listAssets(release), expected, false)
    github.api('PATCH', `releases/${release.id}`, { name: title })
    console.log(`Reusing published preview: ${url}`)
    return url
  }
  if (!release) {
    release = readRelease(
      github.api('POST', 'releases', {
        tag_name: build.tag,
        name: title,
        draft: true,
        prerelease: true,
        make_latest: 'false',
        body: `${PREVIEW_RELEASE_MARKER}\n${source}.\n\nInstall:\n\n\`\`\`sh\npnpm add "${getPreviewTarballUrl(build, 'remix', github.repository)}"\n\`\`\`\n`,
      }),
    )
  }
  // Drafts may contain only part of a previous attempt or bytes from a fresh rebuild.
  for (let asset of github.listAssets(release)) github.delete(`releases/assets/${asset.id}`)
  for (let filename of files) github.upload(release, filename)
  verifyAssets(github.listAssets(release), expected, true)
  // Builds can finish out of order, so only the newest main commit becomes the latest release.
  let latest =
    build.channel === 'main' &&
    github
      .listReleases()
      .every(
        (item) =>
          item.draft ||
          getPreviewChannel(item.tag_name) !== 'main' ||
          getPreviewTagTime(item.tag_name) <= getPreviewTagTime(build.tag),
      )
  github.api('PATCH', `releases/${release.id}`, {
    name: title,
    draft: false,
    prerelease: build.channel !== 'main',
    make_latest: String(latest),
  })
  console.log(`Published preview: ${url}`)
  return url
}

function publishPrPreview(
  github: PreviewGitHub,
  build: PreviewBuild,
  release: PreviewRelease | undefined,
  files: string[],
  expected: { name: string; size: number; digest: string }[],
  repositoryUrl: string,
  title: string,
): string {
  let prNumber = build.channel.slice('pr-'.length)
  let prUrl = `${repositoryUrl}/pull/${prNumber}`
  let header = `${PREVIEW_RELEASE_MARKER}\nPreview builds for [PR #${prNumber}](${prUrl}).\n\nThe latest 10 successful SHA builds are retained until this PR closes.\n`
  if (
    release &&
    (!release.body.startsWith(PREVIEW_RELEASE_MARKER) || !release.body.includes(`](${prUrl})`))
  ) {
    throw new Error(`Preview release does not match the source PR: ${build.tag}`)
  }
  if (!release) {
    release = readRelease(
      github.api('POST', 'releases', {
        tag_name: build.tag,
        name: title,
        draft: true,
        prerelease: true,
        make_latest: 'false',
        body: header,
      }),
    )
  }
  let assets = github.listAssets(release)
  let complete = getCompletedPrPreviewBuilds(assets).find(
    (item) => item.sha.slice(0, 8) === build.sha.slice(0, 8),
  )
  if (complete) {
    if (complete.sha !== build.sha)
      throw new Error(`Preview filename SHA collision: ${build.sha.slice(0, 8)}`)
    verifyAssets(
      assets.filter((asset) => asset.name.endsWith(`-${build.sha.slice(0, 8)}.tgz`)),
      expected,
      false,
    )
    console.log(`Reusing published preview SHA: ${build.sha}`)
  } else {
    // Publishing is serialized per PR, so unmarked SHA groups are interrupted uploads.
    for (let asset of getExpiredPrPreviewAssets(assets))
      github.delete(`releases/assets/${asset.id}`)
    assets = github.listAssets(release)
    if (assets.length + files.length > 1000) throw new Error('Preview release asset limit exceeded')
    for (let filename of files) github.upload(release, filename)
    assets = github.listAssets(release)
    verifyAssets(
      assets.filter((asset) => asset.name.endsWith(`-${build.sha.slice(0, 8)}.tgz`)),
      expected,
      true,
    )
    let remix = assets.find((asset) => asset.name === getPreviewAssetName(build, 'remix'))
    if (!remix) throw new Error('Missing remix preview asset')
    github.api('PATCH', `releases/assets/${remix.id}`, {
      label: `${PR_BUILD_COMPLETE}: ${build.sha}`,
    })
  }
  assets = github.listAssets(release)
  for (let asset of getExpiredPrPreviewAssets(assets)) github.delete(`releases/assets/${asset.id}`)
  let retained = getCompletedPrPreviewBuilds(assets).slice(0, 10)
  let rows = retained.map(({ sha, asset }) => {
    let url = getPreviewTarballUrl({ ...build, sha }, 'remix', github.repository)
    return `| [${sha.slice(0, 8)}](${prUrl}/commits/${sha}) | ${asset.updated_at} | \`pnpm add "${url}"\` |`
  })
  github.api('PATCH', `releases/${release.id}`, {
    name: title,
    draft: false,
    prerelease: true,
    make_latest: 'false',
    body: `${header}\n| Source SHA | Published (UTC) | Install |\n| --- | --- | --- |\n${rows.join('\n')}\n`,
  })
  if (!retained.some((item) => item.sha === build.sha))
    throw new Error('This preview SHA is no longer retained')
  let url = `https://github.com/${github.repository}/releases/tag/${build.tag}`
  console.log(`Published preview: ${url} (${build.sha})`)
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

export function cleanupPrPreviewBranch(
  github: PreviewGitHub,
  channel: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): void {
  if (!/^pr-[1-9]\d*$/.test(channel)) throw new Error('Invalid legacy PR preview channel')
  console.log(`${dryRun ? 'Would delete' : 'Deleting'} legacy preview branch: preview/${channel}`)
  if (!dryRun) github.delete(`git/refs/heads/preview/${channel}`)
}

export function readPullRequest(
  repository: string,
  number: number,
  run = createGitHubRunner(process.env.GITHUB_TOKEN),
): { closed: boolean; sha: string; headRef: string; title: string; createdAt: string } {
  validatePreviewRepository(repository)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid PR number')
  let value: unknown = JSON.parse(run(['api', `repos/${repository}/pulls/${number}`]))
  if (
    !isRecord(value) ||
    (value.state !== 'open' && value.state !== 'closed') ||
    typeof value.title !== 'string' ||
    typeof value.created_at !== 'string' ||
    !Number.isFinite(Date.parse(value.created_at)) ||
    !isRecord(value.head) ||
    typeof value.head.ref !== 'string' ||
    typeof value.head.sha !== 'string'
  ) {
    throw new Error(`Invalid PR response: ${number}`)
  }
  return {
    closed: value.state === 'closed',
    sha: value.head.sha,
    headRef: value.head.ref,
    title: value.title,
    createdAt: value.created_at,
  }
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
    !(value.label === null || typeof value.label === 'string') ||
    typeof value.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(value.updated_at)) ||
    !(value.digest == null || typeof value.digest === 'string')
  )
    throw new Error('Invalid GitHub asset')
  return {
    id: value.id,
    name: value.name,
    state: value.state,
    size: value.size,
    digest: value.digest ?? null,
    label: value.label,
    updated_at: value.updated_at,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
