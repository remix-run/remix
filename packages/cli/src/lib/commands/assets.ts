import * as fs from 'node:fs'
import * as path from 'node:path'
import * as process from 'node:process'
import { createAssetServer, type AssetDetails } from '@remix-run/assets'

import type { CliContext } from '../cli-context.ts'
import { assetsConfigRequired, renderCliError, toCliError } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'

export async function runAssetsCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getAssetsCommandHelpText())
    return 0
  }

  try {
    let parsed = parseArgs(argv, {}, { maxPositionals: 1 })
    let config = await context.loadConfig()
    if (config.assets === undefined) throw assetsConfigRequired()

    let assetServer = createAssetServer({ ...config.assets, watch: false })
    try {
      let input = parsed.positionals[0]
      let rootDir = fs.realpathSync(config.assets.rootDir)

      if (input === undefined) {
        process.stdout.write(formatAssetList(await assetServer.getAssets(), rootDir))
      } else {
        process.stdout.write(formatAssetDetails(await assetServer.getAssetDetails(input), rootDir))
      }
    } finally {
      await assetServer.close()
    }

    return 0
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getAssetsCommandHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getAssetsCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'List browser-reachable assets or inspect one asset URL or file.',
      examples: [
        'remix assets',
        'remix assets /assets/app/actions/public/entry.ts',
        'remix assets app/actions/public/entry.ts',
      ],
      usage: ['remix assets [url-or-file]'],
    },
    target,
  )
}

function formatAssetList(assets: readonly AssetDetails[], rootDir: string): string {
  if (assets.length === 0) return 'No assets.\n'
  return `${assets
    .map((asset) => `${asset.url} -> ${formatFilePath(asset.filePath, rootDir)}`)
    .join('\n')}\n`
}

function formatAssetDetails(details: AssetDetails, rootDir: string): string {
  let lines = [`Status: ${details.status}`]
  if (details.url !== undefined) lines.push(`URL: ${details.url}`)
  if (details.filePath !== undefined) {
    lines.push(`File: ${formatFilePath(details.filePath, rootDir)}`)
  }
  if (details.access?.deniedBy !== undefined) {
    lines.push(`Denied by: ${details.access.deniedBy}`)
  }
  return `${lines.join('\n')}\n`
}

function formatFilePath(filePath: string | undefined, rootDir: string): string {
  if (filePath === undefined) return ''
  let relativePath = path.relative(rootDir, filePath)
  return relativePath === '' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
    ? filePath
    : relativePath.split(path.sep).join('/')
}
