import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { formatCommand, logAndExec } from './process.ts'
import {
  getPreviewTag,
  getPreviewTarballUrl,
  preparePreviewPackage,
  validatePreviewRepository,
} from './preview.ts'
import type { PreviewManifest, PreviewPackageManifest } from './preview.ts'

export async function buildPreview(
  channel: string,
  directory: string,
  {
    dryRun = false,
    repository = process.env.REMIX_PREVIEWS_REPOSITORY ?? 'remix-run/previews',
  }: { dryRun?: boolean; repository?: string } = {},
): Promise<PreviewManifest> {
  validatePreviewRepository(repository)
  let sha = logAndExec('git', ['rev-parse', 'HEAD'], true)
  let tag = getPreviewTag(channel, sha)
  let entries = await fsp.readdir('packages', { withFileTypes: true })
  let packages: { dirName: string; content: string; manifest: PreviewPackageManifest }[] = []
  for (let entry of entries) {
    if (!entry.isDirectory()) continue
    let content = await fsp.readFile(`packages/${entry.name}/package.json`, 'utf8')
    let manifest: PreviewPackageManifest = JSON.parse(content)
    if (!manifest.private) packages.push({ dirName: entry.name, content, manifest })
  }
  let urls = new Map(
    packages.map(({ dirName, manifest }) => [
      manifest.name,
      getPreviewTarballUrl(tag, dirName, repository),
    ]),
  )
  let manifest: PreviewManifest = {
    repository,
    sourceRepository: validatePreviewRepository(process.env.GITHUB_REPOSITORY ?? 'remix-run/remix'),
    channel,
    sha,
    tag,
    createdAt: new Date().toISOString(),
    packages: Object.fromEntries(urls),
  }
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
    if (!dryRun)
      await fsp.writeFile(
        path.join(directory, 'preview.json'),
        JSON.stringify(manifest, null, 2) + '\n',
      )
  } finally {
    if (!dryRun) {
      for (let { dirName, content } of packages)
        await fsp.writeFile(`packages/${dirName}/package.json`, content)
    }
  }
  console.log(
    `${dryRun ? 'Would build' : 'Built'} ${tag}\nInstall after publication: pnpm add "${urls.get('remix')}"`,
  )
  return manifest
}
