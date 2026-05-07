import type { FileStorage } from '@remix-run/file-storage'
import { supportedScriptExtensions } from '../scripts/resolve.ts'

export interface AssetFileTransformResult {
  content: string | Uint8Array
  extension?: string
}

type AssetRequestTransformParamMode = true | 'optional' | undefined

declare const assetRequestTransformTypes: unique symbol

type AssetRequestTransformTypes<
  param extends string,
  mode extends AssetRequestTransformParamMode,
> = {
  input: param
  mode: mode
}

export interface AssetTransformContext {
  extension: string
  filePath: string
}

type AssetRequestTransformRuntimeParam<mode extends AssetRequestTransformParamMode> =
  mode extends true ? string : mode extends 'optional' ? string | undefined : undefined

export interface AssetRequestTransformContext<
  mode extends AssetRequestTransformParamMode = undefined,
> extends AssetTransformContext {
  param: AssetRequestTransformRuntimeParam<mode>
}

export interface AssetGlobalTransformContext extends AssetTransformContext {}

export type AssetRequestTransform<
  param extends string = string,
  mode extends AssetRequestTransformParamMode = undefined,
> = {
  readonly [assetRequestTransformTypes]?: AssetRequestTransformTypes<param, mode>
  /**
   * Optional list of file extensions this transform accepts. Values must use `.ext` format.
   * Matching is evaluated against the current extension at this point in the transform pipeline.
   */
  extensions?: readonly string[]
  transform(
    bytes: Uint8Array,
    context: AssetRequestTransformContext<mode>,
  ):
    | string
    | Uint8Array
    | AssetFileTransformResult
    | Promise<string | Uint8Array | AssetFileTransformResult>
} & (mode extends undefined ? { param?: undefined } : { param: mode })

type AssetGlobalTransformHandler = (
  bytes: Uint8Array,
  context: AssetGlobalTransformContext,
) =>
  | string
  | Uint8Array
  | AssetFileTransformResult
  | null
  | Promise<string | Uint8Array | AssetFileTransformResult | null>

export type AssetGlobalTransform =
  | AssetGlobalTransformHandler
  | {
      /**
       * Optional list of file extensions this transform accepts. Values must use `.ext` format.
       * Non-matching files are skipped automatically.
       */
      extensions?: readonly string[]
      name?: string
      transform: AssetGlobalTransformHandler
    }

interface ResolvedAssetGlobalTransform {
  extensions?: readonly string[]
  name?: string
  transform: AssetGlobalTransformHandler
}

export type AssetRequestTransformMap = Readonly<
  Record<string, AssetRequestTransform<string, AssetRequestTransformParamMode>>
>

export interface AssetServerFilesOptions<transforms extends AssetRequestTransformMap = {}> {
  /**
   * File extensions to expose as leaf assets. Values must include the leading dot,
   * for example `['.png', '.svg', '.woff2']`.
   */
  extensions: readonly string[]
  /**
   * Named transforms that can be requested from asset URLs.
   */
  transforms?: transforms
  /**
   * Maximum number of request transforms allowed in a single asset URL.
   * Defaults to `5`.
   */
  maxRequestTransforms?: number
  /**
   * Ordered transforms that run for every served file asset and may return `null`
   * to skip themselves for a given input.
   */
  globalTransforms?: readonly AssetGlobalTransform[]
  /**
   * Optional backing store for cached transformed file outputs.
   */
  cache?: FileStorage
}

export interface ResolvedAssetServerFilesOptions<transforms extends AssetRequestTransformMap = {}> {
  cache?: FileStorage
  extensions: readonly string[]
  globalTransforms: readonly ResolvedAssetGlobalTransform[]
  hasTransforms: boolean
  maxRequestTransforms: number
  transforms: transforms
}

type AssetTransformStep<
  name extends string,
  param extends string,
  mode extends AssetRequestTransformParamMode,
> = mode extends true
  ? readonly [name, param]
  : mode extends 'optional'
    ? name | readonly [name] | readonly [name, param]
    : name | readonly [name]

export type AssetTransformInvocation<transforms extends AssetRequestTransformMap> = {
  [name in keyof transforms & string]: transforms[name] extends {
    readonly [assetRequestTransformTypes]?: infer types
  }
    ? types extends {
        input: infer param extends string
        mode: infer mode extends AssetRequestTransformParamMode
      }
      ? AssetTransformStep<name, param, mode>
      : never
    : never
}[keyof transforms & string]

export function defineFileTransform(
  transform: AssetRequestTransform<string, undefined>,
): AssetRequestTransform<string, undefined>
export function defineFileTransform<const param extends string = string>(
  transform: AssetRequestTransform<param, true>,
): AssetRequestTransform<param, true>
export function defineFileTransform<const param extends string = string>(
  transform: AssetRequestTransform<param, 'optional'>,
): AssetRequestTransform<param, 'optional'>
export function defineFileTransform(
  transform: AssetRequestTransform<string, AssetRequestTransformParamMode>,
): AssetRequestTransform<string, AssetRequestTransformParamMode> {
  return transform
}

const reservedFileExtensions = new Set<string>([...supportedScriptExtensions, '.css', '.map'])
const defaultMaxRequestTransforms = 5

export function normalizeFilesOptions<transforms extends AssetRequestTransformMap>(
  files: AssetServerFilesOptions<transforms> | undefined,
): ResolvedAssetServerFilesOptions<transforms> {
  if (files == null) {
    return {
      extensions: [],
      globalTransforms: [],
      hasTransforms: false,
      maxRequestTransforms: defaultMaxRequestTransforms,
      transforms: {} as transforms,
    }
  }

  if (!Array.isArray(files.extensions)) {
    throw new TypeError('files.extensions must be an array')
  }

  let normalizedExtensions: string[] = []
  let seen = new Set<string>()

  for (let extension of files.extensions) {
    if (typeof extension !== 'string') {
      throw new TypeError('files.extensions values must be strings')
    }

    let normalizedExtension = extension.trim().toLowerCase()
    if (!/^\.[A-Za-z0-9_-]+$/.test(normalizedExtension)) {
      throw new TypeError(
        `files.extensions values must use ".ext" format. Received "${extension}".`,
      )
    }

    if (reservedFileExtensions.has(normalizedExtension)) {
      throw new TypeError(
        `files.extensions cannot include compiled asset extensions like "${normalizedExtension}".`,
      )
    }

    if (seen.has(normalizedExtension)) continue
    seen.add(normalizedExtension)
    normalizedExtensions.push(normalizedExtension)
  }

  let transforms = files.transforms ?? {}
  if (transforms === null || typeof transforms !== 'object' || Array.isArray(transforms)) {
    throw new TypeError('files.transforms must be an object')
  }

  let normalizedTransformsEntries: [
    string,
    AssetRequestTransform<string, AssetRequestTransformParamMode>,
  ][] = []

  for (let [name, transform] of Object.entries(transforms)) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new TypeError(
        `files.transforms keys must use "transform-name" format. Received "${name}".`,
      )
    }

    if (
      transform === null ||
      typeof transform !== 'object' ||
      typeof transform.transform !== 'function'
    ) {
      throw new TypeError(`files.transforms.${name} must define a transform() function`)
    }

    if (
      'param' in transform &&
      transform.param !== undefined &&
      transform.param !== true &&
      transform.param !== 'optional'
    ) {
      throw new TypeError(`files.transforms.${name}.param must be true or "optional"`)
    }

    normalizedTransformsEntries.push([
      name,
      {
        ...transform,
        extensions: normalizeTransformExtensions(
          transform.extensions,
          `files.transforms.${name}.extensions`,
        ),
      },
    ])
  }

  let normalizedTransforms = Object.fromEntries(normalizedTransformsEntries) as transforms

  let globalTransforms = files.globalTransforms ?? []
  if (!Array.isArray(globalTransforms)) {
    throw new TypeError('files.globalTransforms must be an array')
  }

  let normalizedGlobalTransforms: ResolvedAssetGlobalTransform[] = []

  for (let [index, transform] of globalTransforms.entries()) {
    if (typeof transform === 'function') {
      normalizedGlobalTransforms.push({ transform })
      continue
    }

    if (transform === null || typeof transform !== 'object') {
      throw new TypeError(`files.globalTransforms[${index}] must be a function or object`)
    }

    if ('name' in transform && transform.name !== undefined && typeof transform.name !== 'string') {
      throw new TypeError(`files.globalTransforms[${index}].name must be a string`)
    }

    if (typeof transform.transform !== 'function') {
      throw new TypeError(`files.globalTransforms[${index}] must define a transform() function`)
    }

    normalizedGlobalTransforms.push({
      ...transform,
      extensions: normalizeTransformExtensions(
        transform.extensions,
        `files.globalTransforms[${index}].extensions`,
      ),
    })
  }

  let maxRequestTransforms = files.maxRequestTransforms ?? defaultMaxRequestTransforms
  if (!Number.isInteger(maxRequestTransforms) || maxRequestTransforms < 1) {
    throw new TypeError('files.maxRequestTransforms must be a positive integer')
  }

  if (files.cache !== undefined) {
    if (
      files.cache === null ||
      typeof files.cache !== 'object' ||
      typeof files.cache.get !== 'function' ||
      typeof files.cache.set !== 'function'
    ) {
      throw new TypeError('files.cache must implement the FileStorage interface')
    }
  }

  return {
    cache: files.cache,
    extensions: normalizedExtensions,
    globalTransforms: normalizedGlobalTransforms,
    hasTransforms:
      Object.keys(normalizedTransforms).length > 0 || normalizedGlobalTransforms.length > 0,
    maxRequestTransforms,
    transforms: normalizedTransforms,
  }
}

function normalizeTransformExtensions(
  extensions: readonly string[] | undefined,
  optionPath: string,
): readonly string[] | undefined {
  if (extensions === undefined) return undefined
  if (!Array.isArray(extensions)) {
    throw new TypeError(`${optionPath} must be an array`)
  }
  if (extensions.length === 0) {
    throw new TypeError(`${optionPath} must include at least one extension`)
  }

  let normalizedExtensions: string[] = []
  let seen = new Set<string>()

  for (let extension of extensions) {
    if (typeof extension !== 'string') {
      throw new TypeError(`${optionPath} values must be strings`)
    }

    let normalizedExtension = extension.trim().toLowerCase()
    if (!/^\.[A-Za-z0-9_-]+$/.test(normalizedExtension)) {
      throw new TypeError(`${optionPath} values must use ".ext" format. Received "${extension}".`)
    }

    if (seen.has(normalizedExtension)) continue
    seen.add(normalizedExtension)
    normalizedExtensions.push(normalizedExtension)
  }

  return normalizedExtensions
}

export function serializeAssetTransformInvocations<transforms extends AssetRequestTransformMap>(
  transforms: readonly AssetTransformInvocation<transforms>[],
  transformsByName: transforms,
  maxTransforms = defaultMaxRequestTransforms,
): string[] {
  if (transforms.length > maxTransforms) {
    throw new TypeError(`Expected at most ${maxTransforms} request transforms`)
  }

  return transforms.map((transformInvocation) =>
    normalizeAssetTransformInvocation(transformInvocation, transformsByName, (message) => {
      throw new TypeError(message)
    }),
  )
}

export function parseAssetTransformInvocations<transforms extends AssetRequestTransformMap>(
  transformsQuery: readonly string[],
  transformsByName: transforms,
  maxTransforms = defaultMaxRequestTransforms,
): readonly (string | readonly [string, string])[] {
  if (transformsQuery.length > maxTransforms) {
    throw new TypeError(`Expected at most ${maxTransforms} request transforms`)
  }

  return transformsQuery.map((transformQuery) =>
    parseSerializedAssetTransformInvocation(transformQuery, transformsByName, (message) => {
      throw new TypeError(message)
    }),
  )
}

function normalizeAssetTransformInvocation<transforms extends AssetRequestTransformMap>(
  transformInvocation: unknown,
  transformsByName: transforms,
  onError: (message: string) => never,
): string {
  if (typeof transformInvocation === 'string') {
    if (!/^[A-Za-z0-9_-]+$/.test(transformInvocation)) {
      return onError('Expected each transform name to use "transform-name" format')
    }

    let transform = transformsByName[transformInvocation]
    if (!transform) {
      return onError(`Unknown file transform "${transformInvocation}"`)
    }

    if (transform.param === true) {
      return onError(`File transform "${transformInvocation}" requires a param`)
    }

    return transformInvocation
  }

  if (!Array.isArray(transformInvocation)) {
    return onError('Expected each transform to be a string name or tuple')
  }

  if (transformInvocation.length === 0 || transformInvocation.length > 2) {
    return onError('Expected each transform tuple to have one or two items')
  }

  let [name, rawParam] = transformInvocation
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(name)) {
    return onError('Expected each transform name to use "transform-name" format')
  }

  let transform = transformsByName[name]
  if (!transform) {
    return onError(`Unknown file transform "${name}"`)
  }

  if (transformInvocation.length === 1) {
    if (transform.param === true) {
      return onError(`File transform "${name}" requires a param`)
    }

    return name
  }

  if (typeof rawParam !== 'string') {
    return onError(`Invalid param for file transform "${name}": expected a string`)
  }

  if (transform.param === undefined) {
    if (transformInvocation.length === 2) {
      return onError(`File transform "${name}" does not accept a param`)
    }

    return name
  }

  return `${name}:${rawParam}`
}

function parseSerializedAssetTransformInvocation<transforms extends AssetRequestTransformMap>(
  transformQuery: string,
  transformsByName: transforms,
  onError: (message: string) => never,
): string | readonly [string, string] {
  let separatorIndex = transformQuery.indexOf(':')
  let name = separatorIndex === -1 ? transformQuery : transformQuery.slice(0, separatorIndex)
  let param = separatorIndex === -1 ? undefined : transformQuery.slice(separatorIndex + 1)

  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    return onError('Expected each transform name to use "transform-name" format')
  }

  let transform = transformsByName[name]
  if (!transform) {
    return onError(`Unknown file transform "${name}"`)
  }

  if (transform.param === undefined) {
    if (param !== undefined) {
      return onError(`File transform "${name}" does not accept a param`)
    }

    return name
  }

  if (transform.param === true && param === undefined) {
    return onError(`File transform "${name}" requires a param`)
  }

  if (param === undefined) {
    return name
  }

  return [name, param]
}
