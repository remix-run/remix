import * as cp from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  PREVIEW_RELEASE_MARKER,
  getExpiredPreviewReleases,
  validatePreviewRepository,
} from './preview.ts'
import type { PreviewManifest, PreviewRelease } from './preview.ts'

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
  manifest: PreviewManifest,
  directory: string,
  dryRun = false,
): string {
  if (manifest.repository !== github.repository) throw new Error('Preview repository mismatch')
  let files = [
    ...Object.values(manifest.packages).map((url) =>
      path.join(directory, new URL(url).pathname.split('/').at(-1) ?? ''),
    ),
    path.join(directory, 'preview.json'),
  ]
  let expected = files.map((filename) => {
    let data = fs.readFileSync(filename)
    if (!data.length) throw new Error(`Empty preview asset: ${filename}`)
    return {
      name: path.basename(filename),
      size: data.length,
      digest: `sha256:${createHash('sha256').update(data).digest('hex')}`,
    }
  })
  let url = `https://github.com/${github.repository}/releases/tag/${manifest.tag}`
  if (dryRun) {
    console.log(
      `Would publish ${url} with assets: ${expected.map((asset) => asset.name).join(', ')}`,
    )
    return url
  }

  let release = github.listReleases().find((item) => item.tag_name === manifest.tag)
  if (release && !release.body.startsWith(PREVIEW_RELEASE_MARKER)) {
    throw new Error(`Refusing to replace an unrelated release: ${manifest.tag}`)
  }
  if (release && !release.draft) {
    verifyAssets(github.listAssets(release), expected, false)
    console.log(`Reusing published preview: ${url}`)
    return url
  }
  if (!release) {
    release = readRelease(
      github.api('POST', 'releases', {
        tag_name: manifest.tag,
        name: manifest.tag,
        draft: true,
        prerelease: true,
        make_latest: 'false',
        body: `${PREVIEW_RELEASE_MARKER}\nBuilt from [${manifest.sourceRepository}@${manifest.sha}](https://github.com/${manifest.sourceRepository}/commit/${manifest.sha}).\n\nInstall:\n\n\`\`\`sh\npnpm add "${manifest.packages.remix}"\n\`\`\`\n`,
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
  manifest: PreviewManifest,
  directory: string,
  { dryRun = false, isMerged }: { dryRun?: boolean; isMerged?: () => boolean } = {},
): boolean {
  let prNumber = /^pr-([1-9]\d*)$/.exec(manifest.channel)?.[1]
  let merged = () =>
    prNumber !== undefined &&
    (isMerged ? isMerged() : readPullRequest(manifest.sourceRepository, Number(prNumber)).merged)
  let published = false
  try {
    if (dryRun || !merged()) {
      publishPreview(github, manifest, directory, dryRun)
      published = true
      if (!dryRun && manifest.channel === 'main') cleanupPreviews(github, 'main')
    }
  } finally {
    if (!dryRun && merged()) {
      cleanupPreviews(github, manifest.channel)
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
): { merged: boolean; sha: string } {
  validatePreviewRepository(repository)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid PR number')
  let value: unknown = JSON.parse(run(['api', `repos/${repository}/pulls/${number}`]))
  if (
    !isRecord(value) ||
    typeof value.merged !== 'boolean' ||
    !isRecord(value.head) ||
    typeof value.head.sha !== 'string'
  ) {
    throw new Error(`Invalid PR response: ${number}`)
  }
  return { merged: value.merged, sha: value.head.sha }
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
