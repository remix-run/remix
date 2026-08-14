import * as path from 'node:path'
import * as process from 'node:process'

import { resolveDefaultRemixVersion } from './remix-version.ts'
import { loadRemixConfig, type RemixConfig } from './remix-config.ts'

interface ResolveCliContextOptions {
  configPath?: string
  cwd?: string
  remixVersion?: string
}

export interface CliContext {
  /** Explicit Remix configuration path selected by the caller. */
  configPath?: string
  cwd: string
  /** Loads and validates the Remix config file, memoizing the result. */
  loadConfig(): Promise<RemixConfig>
  remixVersion?: string
}

export async function resolveCliContext(
  options: ResolveCliContextOptions = {},
): Promise<CliContext> {
  let cwd = resolveCwd(options.cwd)
  let remixVersion = normalizeRemixVersion(options.remixVersion)

  let configPromise: Promise<RemixConfig> | undefined
  let loadConfig = () => (configPromise ??= loadRemixConfig(cwd, options.configPath))

  // Validate an explicitly selected config file up front so every command
  // fails fast on a bad --config path. The default remix.json is loaded
  // lazily by the commands that read it, so an invalid file doesn't break
  // unrelated commands like help, version, or shell completion.
  if (options.configPath !== undefined) await loadConfig()

  return {
    configPath: options.configPath,
    cwd,
    loadConfig,
    remixVersion: remixVersion ?? (await resolveDefaultRemixVersion(cwd)),
  }
}

function resolveCwd(cwd: string | undefined): string {
  let normalizedCwd = cwd?.trim()
  return path.resolve(
    normalizedCwd == null || normalizedCwd.length === 0 ? process.cwd() : normalizedCwd,
  )
}

function normalizeRemixVersion(remixVersion: string | undefined): string | undefined {
  let normalizedVersion = remixVersion?.trim()
  return normalizedVersion == null || normalizedVersion.length === 0 ? undefined : normalizedVersion
}
