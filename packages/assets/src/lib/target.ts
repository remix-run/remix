import type { Targets as LightningCssTargets } from 'lightningcss'

const browserTargetNames = [
  'chrome',
  'edge',
  'firefox',
  'ie',
  'ios',
  'opera',
  'safari',
  'samsung',
] as const

const browserTargetNameSet = new Set<string>(browserTargetNames)

const lightningCssTargetNameByBrowserTargetName = {
  chrome: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  ie: 'ie',
  ios: 'ios_saf',
  opera: 'opera',
  safari: 'safari',
  samsung: 'samsung',
} as const satisfies Record<BrowserTargetName, keyof LightningCssTargets>

export type AssetTargetVersion =
  | `${number}`
  | `${number}.${number}`
  | `${number}.${number}.${number}`
export type BrowserTargetName = (typeof browserTargetNames)[number]
export type ResolvedScriptTarget = string[]
export type ResolvedStyleTarget = LightningCssTargets

export interface AssetTarget {
  chrome?: AssetTargetVersion
  edge?: AssetTargetVersion
  firefox?: AssetTargetVersion
  ie?: AssetTargetVersion
  ios?: AssetTargetVersion
  opera?: AssetTargetVersion
  safari?: AssetTargetVersion
  samsung?: AssetTargetVersion
  es?: string
}

type NormalizedAssetTarget = Partial<Record<BrowserTargetName, AssetTargetVersion>> & {
  es?: AssetTarget['es']
}

export function resolveScriptTarget(
  target: AssetTarget | undefined,
): ResolvedScriptTarget | undefined {
  let resolvedTarget = normalizeScriptTargetObject(target, 'target')
  if (!resolvedTarget) return undefined

  let oxcTarget: ResolvedScriptTarget = []
  if (resolvedTarget.es) {
    oxcTarget.push(resolvedTarget.es)
  }

  for (let browserTargetName of browserTargetNames) {
    let version = resolvedTarget[browserTargetName]
    if (version == null) continue
    oxcTarget.push(`${browserTargetName}${version}`)
  }

  return oxcTarget
}

export function resolveStyleTarget(
  target: AssetTarget | undefined,
): ResolvedStyleTarget | undefined {
  let resolvedTarget = normalizeStyleTargetObject(target, 'target')
  if (!resolvedTarget) return undefined

  let lightningCssTargets: ResolvedStyleTarget = {}
  for (let browserTargetName of browserTargetNames) {
    let version = resolvedTarget[browserTargetName]
    if (version == null) continue
    lightningCssTargets[lightningCssTargetNameByBrowserTargetName[browserTargetName]] =
      toLightningCssTargetVersion(version)
  }

  return lightningCssTargets
}

function normalizeScriptTargetObject(
  target: AssetTarget | undefined,
  optionPath: string,
): NormalizedAssetTarget | undefined {
  if (target == null) return undefined
  if (!isPlainObject(target)) {
    throw new TypeError(`${optionPath} must be an object`)
  }

  let normalizedTarget: NormalizedAssetTarget = {}

  for (let [key, value] of Object.entries(target)) {
    if (key === 'es') {
      normalizedTarget.es = normalizeScriptTargetVersion(value, `${optionPath}.es`)
      continue
    }

    if (!browserTargetNameSet.has(key)) {
      throw new TypeError(`${optionPath}.${key} is not a supported target`)
    }

    normalizedTarget[key as BrowserTargetName] = normalizeBrowserTargetVersion(
      value,
      `${optionPath}.${key}`,
    )
  }

  return Object.keys(normalizedTarget).length === 0 ? undefined : normalizedTarget
}

function normalizeStyleTargetObject(
  target: AssetTarget | undefined,
  optionPath: string,
): NormalizedAssetTarget | undefined {
  if (target == null) return undefined
  if (!isPlainObject(target)) {
    throw new TypeError(`${optionPath} must be an object`)
  }

  let normalizedTarget: NormalizedAssetTarget = {}

  for (let [key, value] of Object.entries(target)) {
    if (key === 'es') {
      continue
    }

    if (!browserTargetNameSet.has(key)) {
      throw new TypeError(`${optionPath}.${key} is not a supported target`)
    }

    normalizedTarget[key as BrowserTargetName] = normalizeBrowserTargetVersion(
      value,
      `${optionPath}.${key}`,
    )
  }

  return Object.keys(normalizedTarget).length === 0 ? undefined : normalizedTarget
}

function normalizeScriptTargetVersion(value: unknown, optionPath: string): AssetTarget['es'] {
  if (typeof value !== 'string') {
    throw new TypeError(`${optionPath} must be a string`)
  }

  let normalizedValue = value.trim()
  if (normalizedValue.length === 0) {
    throw new TypeError(`${optionPath} must be a non-empty string`)
  }

  if (!/^\d+$/.test(normalizedValue)) {
    throw new TypeError(`${optionPath} must use a single numeric year like "2020"`)
  }

  if (!/^\d{4}$/.test(normalizedValue) || Number(normalizedValue) < 2015) {
    throw new TypeError(`${optionPath} must use a four-digit year of 2015 or higher`)
  }

  return `es${normalizedValue}`
}

function normalizeBrowserTargetVersion(value: unknown, optionPath: string): AssetTargetVersion {
  if (typeof value !== 'string') {
    throw new TypeError(`${optionPath} must be a string`)
  }

  if (value.trim().length === 0) {
    throw new TypeError(`${optionPath} must be a non-empty string`)
  }

  if (!/^\d+(\.\d+){0,2}$/.test(value)) {
    throw new TypeError(`${optionPath} must use "X", "X.Y", or "X.Y.Z" version format`)
  }

  let segments = value.split('.').map(Number)
  if (segments.some((segment) => segment > 255)) {
    throw new TypeError(`${optionPath} must use version components between 0 and 255`)
  }

  return value as AssetTargetVersion
}

function toLightningCssTargetVersion(version: AssetTargetVersion): number {
  let [major, minor = 0, patch = 0] = version.split('.').map(Number)
  return major * 65536 + minor * 256 + patch
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
