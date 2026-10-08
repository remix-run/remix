import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import semver from 'semver'
import facade from '../packages/uwebsockets-js/package.json' with { type: 'json' }
import upstream from '../packages/uwebsockets-js/upstream.json' with { type: 'json' }
import { getRootDir } from './utils/process.ts'

const repository = 'uNetworking/uWebSockets.js'
const root = getRootDir()
const packageDirs = [
  'uwebsockets-js',
  ...Object.keys(facade.optionalDependencies).map((name) => name.replace('@remix-run/', '')),
]

// documented Node ABIs are explicit; add a mapping when upstream adds a new runtime.
const nodeVersions = new Map([
  [115, 20],
  [127, 22],
  [137, 24],
  [141, 25],
  [147, 26],
])

export function getReleaseVersion(release: unknown, currentVersion: string): string | null {
  if (
    typeof release !== 'object' ||
    release === null ||
    !('tag_name' in release) ||
    typeof release.tag_name !== 'string' ||
    !('draft' in release) ||
    typeof release.draft !== 'boolean' ||
    !('prerelease' in release) ||
    typeof release.prerelease !== 'boolean'
  ) {
    throw new Error('Invalid upstream release response.')
  }
  if (release.draft || release.prerelease) return null
  let version = semver.valid(release.tag_name)
  if (version === null) throw new Error(`Invalid upstream version: ${release.tag_name}`)
  if (semver.prerelease(version) !== null || !semver.gt(version, currentVersion)) return null
  return version
}

export function readUpstreamArchive(commit: string, archive: Uint8Array) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid upstream distribution commit.')
  let prefix = `uNetworking-uWebSockets.js-${commit.slice(0, 7)}/`
  let files = new Set(
    execFileSync('tar', ['-tzf', '-'], { input: archive, encoding: 'utf8' }).trim().split('\n'),
  )
  for (let file of ['LICENSE', 'uws.js', 'ESM_wrapper.mjs', 'index.d.ts', 'source_commit']) {
    if (!files.has(prefix + file)) throw new Error(`Upstream archive is missing ${file}.`)
  }
  let sourceCommit = execFileSync('tar', ['-xOzf', '-', prefix + 'source_commit'], {
    input: archive,
    encoding: 'utf8',
  }).trim()
  if (!/^[a-f0-9]{40}$/.test(sourceCommit))
    throw new Error('Invalid upstream native source commit.')
  let platforms = packageDirs.slice(1).map((name) => name.replace('uwebsockets-js-', '').split('-'))
  let nodeAbis = [
    ...new Set(
      platforms.flatMap(([os, arch]) =>
        [...files].flatMap((file) => {
          let match = new RegExp(`^${prefix}uws_${os}_${arch}_(\\d+)\\.node$`).exec(file)
          return match ? [Number(match[1])] : []
        }),
      ),
    ),
  ].sort((a, b) => a - b)
  if (nodeAbis.length === 0) throw new Error('Upstream archive has no supported native binaries.')
  for (let [os, arch] of platforms) {
    for (let abi of nodeAbis) {
      let file = `uws_${os}_${arch}_${abi}.node`
      if (!files.has(prefix + file)) throw new Error(`Upstream archive is missing ${file}.`)
    }
  }
  return {
    sourceCommit,
    nodeAbis,
    archiveSha256: createHash('sha256').update(archive).digest('hex'),
  }
}

export function getNodeVersions(abis: number[]): string {
  return abis
    .map((abi) => {
      let version = nodeVersions.get(abi)
      if (version === undefined) throw new Error(`Document the Node.js version for new ABI ${abi}.`)
      return version
    })
    .join(', ')
}

export async function writeConsumerSupportChanges(
  rootDir: string,
  previousAbis: number[],
  nextAbis: number[],
): Promise<void> {
  if (previousAbis.join(',') === nextAbis.join(',')) return
  let removedAbis = previousAbis.filter((abi) => !nextAbis.includes(abi))
  let runtimes = getNodeVersions(nextAbis)
  for (let dir of ['node-serve', 'remix']) {
    let packageDir = path.join(rootDir, 'packages', dir)
    let metadata: unknown = JSON.parse(
      await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'),
    )
    if (
      typeof metadata !== 'object' ||
      metadata === null ||
      !('version' in metadata) ||
      typeof metadata.version !== 'string' ||
      !semver.valid(metadata.version)
    ) {
      throw new Error(`Invalid package version for ${dir}.`)
    }
    let bump = removedAbis.length > 0 && semver.major(metadata.version) > 0 ? 'major' : 'minor'
    let specifier = dir === 'remix' ? 'remix/node-serve' : 'node-serve'
    let slug = dir === 'remix' ? 'node-serve.node-support' : 'node-support'
    let note = `${removedAbis.length > 0 ? 'BREAKING CHANGE: ' : ''}Supported Node.js versions for \`${specifier}\` are now ${runtimes}.${removedAbis.length > 0 ? ` Support for Node.js ${getNodeVersions(removedAbis)} has been removed. Upgrade to a supported Node.js version before updating.` : ''}\n`
    await fs.mkdir(path.join(packageDir, '.changes'), { recursive: true })
    await fs.writeFile(path.join(packageDir, `.changes/${bump}.${slug}.md`), note)
  }
}

async function main() {
  let preview = process.argv.includes('--preview')
  let release: unknown = JSON.parse(
    execFileSync('gh', ['api', `repos/${repository}/releases/latest`], { encoding: 'utf8' }),
  )
  let version = getReleaseVersion(release, upstream.version)
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, 'updated=false\n')
  if (version === null) {
    console.log(`uWebSockets.js ${upstream.version} is already up to date.`)
    return
  }
  let commit = execFileSync(
    'gh',
    ['api', `repos/${repository}/commits/v${version}`, '--jq', '.sha'],
    {
      encoding: 'utf8',
    },
  ).trim()
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid upstream distribution commit.')
  let response = await fetch(`https://api.github.com/repos/${repository}/tarball/${commit}`)
  if (!response.ok) throw new Error(`Upstream download failed: ${response.status}`)
  let archive = new Uint8Array(await response.arrayBuffer())
  let next = { ...upstream, version, commit, ...readUpstreamArchive(commit, archive) }
  let runtimes = getNodeVersions(next.nodeAbis)
  let supportChanged = next.nodeAbis.join(',') !== upstream.nodeAbis.join(',')
  let removedAbis = upstream.nodeAbis.filter((abi) => !next.nodeAbis.includes(abi))
  let bump =
    removedAbis.length > 0
      ? semver.major(facade.version) === 0
        ? 'minor'
        : 'major'
      : supportChanged
        ? 'minor'
        : 'patch'
  let releaseUrl = `${upstream.repository}/releases/tag/v${version}`
  let compareUrl = `${upstream.repository}/compare/${upstream.commit}...${commit}`
  let body =
    [
      `Update vendored uWebSockets.js from ${upstream.version} to ${version}.`,
      `[Upstream release notes](${releaseUrl}) · [Upstream changes](${compareUrl})`,
      `Node.js versions: ${runtimes}. Node ABIs: ${next.nodeAbis.join(', ')}.`,
      ...(supportChanged
        ? [
            `This update changes Node support from ${getNodeVersions(upstream.nodeAbis)} to ${runtimes}. Review the runtime support change before marking this draft ready.`,
          ]
        : []),
      'The archive checksum and native source commit are pinned, and every supported platform/ABI binary is present. Native payloads are regenerated during builds.',
      'This PR is refreshed by the uWebSockets.js update workflow. Make follow-up edits on a separate branch; the workflow replaces this branch when upstream or the base branch changes.',
    ].join('\n\n') + '\n'
  console.log(JSON.stringify(next, null, 2))
  console.log(body)
  if (preview) return

  let cache = path.join(root, '.tmp/uwebsockets')
  await fs.mkdir(cache, { recursive: true })
  await fs.writeFile(path.join(cache, `${commit}.tar.gz`), archive)
  await fs.writeFile(
    path.join(root, 'packages/uwebsockets-js/upstream.json'),
    JSON.stringify(next, null, 2) + '\n',
  )
  execFileSync(process.execPath, [path.join(root, 'scripts/sync-uwebsockets.ts')], {
    stdio: 'inherit',
  })
  for (let dir of packageDirs) {
    let packageDir = path.join(root, 'packages', dir)
    await fs.mkdir(path.join(packageDir, '.changes'), { recursive: true })
    await fs.writeFile(
      path.join(packageDir, `.changes/${bump}.upstream-update.md`),
      `${removedAbis.length > 0 ? 'BREAKING CHANGE: ' : ''}Update the native transport to [uWebSockets.js ${version}](${releaseUrl}).${supportChanged ? ` Supported Node.js versions are ${runtimes}.` : ''}${removedAbis.length > 0 ? ` Node.js ${getNodeVersions(removedAbis)} are no longer supported.` : ''}\n`,
    )
    let readme = path.join(packageDir, 'README.md')
    let content = await fs.readFile(readme, 'utf8')
    content = content.replace(/Node ABIs [\d, and]+\./, `Node ABIs ${next.nodeAbis.join(', ')}.`)
    content = content.replace(
      /Node\.js [\d, and]+ \(ABIs [\d, and]+\)/,
      `Node.js ${runtimes} (ABIs ${next.nodeAbis.join(', ')})`,
    )
    await fs.writeFile(readme, content)
  }
  if (supportChanged) {
    await writeConsumerSupportChanges(root, upstream.nodeAbis, next.nodeAbis)
    for (let dir of ['packages/node-serve', 'packages/remix/src/node-serve']) {
      let readme = path.join(root, dir, 'README.md')
      let content = await fs.readFile(readme, 'utf8')
      await fs.writeFile(
        readme,
        content.replace(/Node\.js [\d, and]+ are supported/, `Node.js ${runtimes} are supported`),
      )
    }
  }
  await fs.writeFile(path.join(cache, 'pr-body.md'), body)
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `updated=true\nversion=${version}\ndraft=${supportChanged}\n`,
    )
  }
}

if (import.meta.main) await main()
