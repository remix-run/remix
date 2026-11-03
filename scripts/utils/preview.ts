export interface PreviewPackageManifest {
  name: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  scripts?: Record<string, string>
  publishConfig?: Record<string, unknown>
  [key: string]: unknown
}

export interface PreviewManifest {
  repository: string
  sourceRepository: string
  channel: string
  sha: string
  tag: string
  createdAt: string
  packages: Record<string, string>
}

export interface PreviewRelease {
  id: number
  tag_name: string
  body: string
  draft: boolean
  created_at: string
  published_at: string | null
}

export const PREVIEW_RELEASE_MARKER = '<!-- remix-preview -->'

export function getPreviewChannel(tag: string): string | null {
  return (
    /^(main|pr-[1-9]\d*|experimental-[a-zA-Z0-9][a-zA-Z0-9._-]*)-[a-f0-9]{40}$/.exec(tag)?.[1] ??
    null
  )
}

export function getExpiredPreviewReleases(
  releases: PreviewRelease[],
  channel: string,
  now = Date.now(),
): PreviewRelease[] {
  let builds = releases.filter(
    (release) =>
      release.body.startsWith(PREVIEW_RELEASE_MARKER) &&
      getPreviewChannel(release.tag_name) === channel,
  )
  if (/^pr-[1-9]\d*$/.test(channel)) return builds
  if (channel !== 'main') return []

  let latest = builds
    .filter((release) => !release.draft)
    .toSorted(
      (a, b) =>
        Date.parse(b.published_at ?? b.created_at) - Date.parse(a.published_at ?? a.created_at),
    )[0]
  let cutoff = now - 7 * 24 * 60 * 60 * 1000
  return builds.filter(
    (release) =>
      release.id !== latest?.id && Date.parse(release.published_at ?? release.created_at) < cutoff,
  )
}

export function getPreviewTag(channel: string, sha: string): string {
  if (!/^(main|pr-[1-9]\d*|experimental-[a-zA-Z0-9][a-zA-Z0-9._-]*)$/.test(channel)) {
    throw new Error(`Invalid preview channel: ${channel}`)
  }
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error(`Invalid source SHA: ${sha}`)
  return `${channel}-${sha}`
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
  repository = 'remix-run/previews',
): string {
  validatePreviewRepository(repository)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(packageDirName)) {
    throw new Error(`Invalid package directory: ${packageDirName}`)
  }
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${packageDirName}.tgz`
}

export function readPreviewManifest(content: string): PreviewManifest {
  let value: unknown = JSON.parse(content)
  if (
    typeof value !== 'object' ||
    value === null ||
    !('repository' in value) ||
    typeof value.repository !== 'string' ||
    !('sourceRepository' in value) ||
    typeof value.sourceRepository !== 'string' ||
    !('channel' in value) ||
    typeof value.channel !== 'string' ||
    !('sha' in value) ||
    typeof value.sha !== 'string' ||
    !('tag' in value) ||
    value.tag !== getPreviewTag(value.channel, value.sha) ||
    !('createdAt' in value) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !('packages' in value) ||
    typeof value.packages !== 'object' ||
    value.packages === null ||
    Array.isArray(value.packages)
  )
    throw new Error('Invalid preview manifest')

  validatePreviewRepository(value.repository)
  validatePreviewRepository(value.sourceRepository)
  let packages: Record<string, string> = {}
  let names = new Set<string>()
  for (let [name, url] of Object.entries(value.packages)) {
    if (typeof url !== 'string') throw new Error(`Invalid preview URL for ${name}`)
    let filename = new URL(url).pathname.split('/').at(-1) ?? ''
    let dirName = filename.replace(/\.tgz$/, '')
    if (url !== getPreviewTarballUrl(value.tag, dirName, value.repository) || names.has(filename)) {
      throw new Error(`Invalid or duplicate preview URL for ${name}`)
    }
    names.add(filename)
    packages[name] = url
  }
  if (!packages.remix) throw new Error('Missing remix preview tarball')
  return {
    repository: value.repository,
    sourceRepository: value.sourceRepository,
    channel: value.channel,
    sha: value.sha,
    tag: value.tag,
    createdAt: value.createdAt,
    packages,
  }
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
