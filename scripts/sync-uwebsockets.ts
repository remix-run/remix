import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import upstream from '../packages/uwebsockets-js/upstream.json' with { type: 'json' }
import facade from '../packages/uwebsockets-js/package.json' with { type: 'json' }

const root = path.resolve(import.meta.dirname, '..')
const cache = path.join(root, `.tmp/uwebsockets/${upstream.commit}.tar.gz`)
const prefix = `uNetworking-uWebSockets.js-${upstream.commit.slice(0, 7)}/`
const requested = process.argv[2]
const platforms = Object.keys(facade.optionalDependencies).map((name) =>
  name.replace('@remix-run/uwebsockets-js-', ''),
)
const current = `${process.platform}-${process.arch}${process.platform === 'linux' ? '-gnu' : ''}`
const selected =
  requested === '--facade'
    ? []
    : requested === '--current'
      ? [current]
      : requested
        ? [requested]
        : platforms

let downloaded = false

for (let platform of selected) {
  if (!platforms.includes(platform)) throw new Error(`Unsupported platform: ${platform}`)
}

let archive: Uint8Array
try {
  archive = await fs.readFile(cache)
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
  let response = await fetch(
    `https://api.github.com/repos/uNetworking/uWebSockets.js/tarball/${upstream.commit}`,
  )
  if (!response.ok) throw new Error(`Upstream download failed: ${response.status}`)
  archive = new Uint8Array(await response.arrayBuffer())
  downloaded = true
}

if (createHash('sha256').update(archive).digest('hex') !== upstream.archiveSha256) {
  throw new Error('Upstream archive checksum mismatch; refusing to vendor it.')
}

if (downloaded) {
  await fs.mkdir(path.dirname(cache), { recursive: true })
  let temporary = `${cache}.${process.pid}`
  await fs.writeFile(temporary, archive)
  try {
    // Keep the shared archive immutable while other builds are reading it.
    await fs.link(temporary, cache)
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
  } finally {
    await fs.rm(temporary)
  }
}

function readUpstream(file: string): Buffer {
  return execFileSync('tar', ['-xOzf', path.basename(cache), prefix + file], {
    cwd: path.dirname(cache),
    maxBuffer: 16 * 1024 * 1024,
  })
}

if (readUpstream('source_commit').toString().trim() !== upstream.sourceCommit) {
  throw new Error('Upstream source attribution does not match the pinned source commit.')
}

if (!requested || requested === '--facade') {
  let dir = path.join(root, 'packages/uwebsockets-js')
  await fs.writeFile(path.join(dir, 'LICENSE'), readUpstream('LICENSE'))
  await fs.writeFile(path.join(dir, 'src/index.d.ts'), readUpstream('index.d.ts'))
  let wrapper = readUpstream('ESM_wrapper.mjs')
    .toString()
    .replace(/(['"])\.\/(?:uws|index)\.js\1/, '$1./index.cjs$1')
  if (!wrapper.includes('export const DeclarativeResponse')) {
    wrapper += '\nexport const DeclarativeResponse = uws.DeclarativeResponse;\n'
  }
  await fs.writeFile(
    path.join(dir, 'src/index.mjs'),
    '// Adapted from the upstream ESM wrapper; see upstream.json and LICENSE.\n' + wrapper,
  )
}

for (let platform of selected) {
  let [os, arch] = platform.split('-')
  let dir = path.join(root, `packages/uwebsockets-js-${platform}`)
  let dist = path.join(dir, 'dist')
  // Remove stale ABIs when the pinned upstream release changes.
  await fs.rm(dist, { recursive: true, force: true })
  await fs.mkdir(dist, { recursive: true })
  for (let file of ['uws.js', 'ESM_wrapper.mjs', 'index.d.ts', 'source_commit']) {
    await fs.writeFile(path.join(dist, file), readUpstream(file))
  }
  for (let abi of upstream.nodeAbis) {
    let file = `uws_${os}_${arch}_${abi}.node`
    await fs.writeFile(path.join(dist, file), readUpstream(file))
  }
  await fs.writeFile(path.join(dir, 'LICENSE'), readUpstream('LICENSE'))
  await fs.copyFile(
    path.join(root, 'packages/uwebsockets-js/upstream.json'),
    path.join(dir, 'upstream.json'),
  )
  console.log(`Synced ${platform} from uWebSockets.js ${upstream.version} (${upstream.commit})`)
}
