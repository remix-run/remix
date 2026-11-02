import * as cp from 'node:child_process'
import * as fsp from 'node:fs/promises'

export interface PreviewPackageManifest {
  name: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  scripts?: Record<string, string>
  publishConfig?: Record<string, unknown>
  [key: string]: unknown
}

export interface PreviewBuild {
  sha: string
  createdAt: string
}

export interface PreviewManifest {
  branch: string
  sha: string
  packages: Record<string, string>
  builds: PreviewBuild[]
}

export interface PreviousPreview {
  commit: string
  manifest: PreviewManifest
}

export function getPreviewTarballUrl(
  branch: string,
  sha: string,
  packageDirName: string,
  repository = 'remix-run/remix',
): string {
  let ref = branch.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${repository}/${ref}/t/${sha.slice(0, 8)}/${packageDirName}.tgz`
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

export function getRetainedPreviewBuilds(
  branch: string,
  builds: PreviewBuild[],
  latestSha: string,
  now = Date.now(),
): PreviewBuild[] {
  if (/^preview\/pr-\d+$/.test(branch)) {
    return builds.filter((build) => build.sha === latestSha)
  }

  let cutoff = now - 7 * 24 * 60 * 60 * 1000
  return builds.filter(
    (build) =>
      branch !== 'preview/main' || build.sha === latestSha || Date.parse(build.createdAt) >= cutoff,
  )
}

export function readPreviewManifest(content: string, fallbackCreatedAt: string): PreviewManifest {
  let value: unknown = JSON.parse(content)
  if (
    typeof value !== 'object' ||
    value === null ||
    !('branch' in value) ||
    typeof value.branch !== 'string' ||
    !('sha' in value) ||
    typeof value.sha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(value.sha) ||
    !('packages' in value) ||
    typeof value.packages !== 'object' ||
    value.packages === null ||
    Array.isArray(value.packages)
  ) {
    throw new Error('Invalid preview manifest')
  }

  let packages: Record<string, string> = {}
  for (let [name, url] of Object.entries(value.packages)) {
    if (typeof url !== 'string') throw new Error(`Invalid preview URL for ${name}`)
    packages[name] = url
  }

  let entries: unknown =
    'builds' in value ? value.builds : [{ sha: value.sha, createdAt: fallbackCreatedAt }]
  if (!isUnknownArray(entries)) throw new Error('Invalid preview builds')
  let builds: PreviewBuild[] = []
  let shas = new Set<string>()
  for (let entry of entries) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('sha' in entry) ||
      typeof entry.sha !== 'string' ||
      !/^[a-f0-9]{40}$/.test(entry.sha) ||
      !('createdAt' in entry) ||
      typeof entry.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(entry.createdAt)) ||
      shas.has(entry.sha.slice(0, 8))
    ) {
      throw new Error('Invalid or duplicate preview build')
    }
    shas.add(entry.sha.slice(0, 8))
    builds.push({ sha: entry.sha, createdAt: entry.createdAt })
  }
  if (!builds.some((build) => build.sha === value.sha)) {
    throw new Error('Latest preview build is missing from the manifest')
  }
  return { branch: value.branch, sha: value.sha, packages, builds }
}

export function loadPreviousPreview(branch: string): PreviousPreview | null {
  let remote = cp.spawnSync(
    'git',
    ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`],
    {
      encoding: 'utf8',
    },
  )
  if (remote.status === 2) return null
  if (remote.status !== 0) throw new Error(`Could not look up preview branch: ${remote.stderr}`)
  let commit = remote.stdout.trim().split(/\s+/)[0]
  git(['fetch', '--no-tags', '--depth=1', 'origin', `+${commit}:refs/remotes/origin/${branch}`])
  let metadata = cp.spawnSync('git', ['show', `${commit}:t/preview.json`], {
    encoding: 'utf8',
  })
  if (metadata.status !== 0) {
    // Previews using an earlier artifact layout start with a fresh build.
    if (git(['ls-tree', '--name-only', commit, 't']).length === 0) return null
    throw new Error(`Could not read preview manifest: ${metadata.stderr}`)
  }
  let manifest = readPreviewManifest(metadata.stdout, git(['show', '-s', '--format=%cI', commit]))
  if (manifest.branch !== branch)
    throw new Error(`Preview metadata is for ${manifest.branch}, not ${branch}`)
  return { commit, manifest }
}

export function restorePreviewTarballs(previous: PreviousPreview, builds: PreviewBuild[]): void {
  if (builds.length === 0) return
  git([
    'restore',
    '--source',
    previous.commit,
    '--worktree',
    '--',
    ...builds.map((build) => `t/${build.sha.slice(0, 8)}`),
  ])
}

export async function writePreviewManifest(manifest: PreviewManifest): Promise<void> {
  await fsp.mkdir('t', { recursive: true })
  await fsp.writeFile('t/preview.json', JSON.stringify(manifest, null, 2) + '\n')
}

function git(args: string[]): string {
  return cp
    .execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .trim()
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}
