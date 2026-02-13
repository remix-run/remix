import picomatch from 'picomatch'
import type { MatchGlob } from './typed-glob/index.ts'

export type Awaitable<value> = value | Promise<value>
type NoInfer<value> = [value][value extends any ? 0 : never]

export interface AssetEntry {
  href: string
  chunks: string[]
}

export interface FileTransformContext {
  sourcePath: string
  ext: string
}

export type FileTransformResult = Buffer | { data: Awaitable<Buffer>; ext?: string }

export type FileTransform = (
  data: Buffer,
  context: FileTransformContext,
) => Awaitable<FileTransformResult>

type DefaultVariantMatchesVariants<
  rule extends FileRule,
  variants extends Record<string, FileTransform>,
> = rule extends { defaultVariant: infer value extends string }
  ? value extends keyof variants & string
    ? rule
    : never
  : rule

type ValidateFileRule<rule extends FileRule> = rule extends {
  variants: infer variants extends Record<string, FileTransform>
}
  ? DefaultVariantMatchesVariants<rule, variants>
  : rule extends { defaultVariant: string }
    ? never
    : rule

type ValidateFiles<files extends readonly FileRule[]> = {
  [index in keyof files]: files[index] extends FileRule
    ? ValidateFileRule<files[index]>
    : files[index]
}

export interface FileRule<
  variants extends Record<string, FileTransform> = Record<string, FileTransform>,
> {
  include: string
  transform?: FileTransform
  variants?: variants
  defaultVariant?: keyof variants & string
}

export type FilesConfig = ReadonlyArray<FileRule>

export function defineFiles<const files extends readonly FileRule[]>(
  files: ValidateFiles<files>,
): files {
  return files
}

type MatchedRule<rule extends FileRule, sourcePath extends string> =
  MatchGlob<sourcePath, rule['include']> extends true ? rule : never

type MatchingRules<
  files extends FilesConfig,
  sourcePath extends string,
> = files[number] extends infer rule
  ? rule extends FileRule
    ? MatchedRule<rule, sourcePath>
    : never
  : never

type VariantNames<files extends FilesConfig, sourcePath extends string> =
  MatchingRules<files, sourcePath> extends infer rule
    ? rule extends { variants: infer variants extends Record<string, FileTransform> }
      ? keyof variants & string
      : never
    : never

type HasDefaultVariant<files extends FilesConfig, sourcePath extends string> =
  MatchingRules<files, sourcePath> extends infer rule
    ? rule extends { defaultVariant: string }
      ? true
      : false
    : false

type HasVariants<files extends FilesConfig, sourcePath extends string> = [
  VariantNames<files, sourcePath>,
] extends [never]
  ? false
  : true

export type VariantArg<files extends FilesConfig, sourcePath extends string> =
  HasVariants<files, sourcePath> extends true
    ? HasDefaultVariant<files, sourcePath> extends true
      ? [variant?: VariantNames<files, sourcePath>]
      : [variant: VariantNames<files, sourcePath>]
    : [variant?: never]

export type TypedAssetsGet<files extends FilesConfig> = <const sourcePath extends string>(
  entryPath: sourcePath,
  ...variant: VariantArg<files, NoInfer<sourcePath>>
) => AssetEntry | null

type DefaultAssetsGet = (entryPath: string, variant?: string) => AssetEntry | null
type HasBroadIncludes<files extends FilesConfig> = string extends files[number]['include']
  ? true
  : false
type AssetsGet<files extends FilesConfig> =
  HasBroadIncludes<files> extends true ? DefaultAssetsGet : TypedAssetsGet<files>

export interface AssetsApi<files extends FilesConfig = FilesConfig> {
  get: AssetsGet<files>
}

export interface CompiledFileRule {
  include: string
  matcher: picomatch.Matcher
  transform?: FileTransform
  variants?: Record<string, FileTransform>
  defaultVariant?: string
}

export function compileFileRules(files: FilesConfig | undefined): CompiledFileRule[] {
  if (!files || files.length === 0) return []
  return files.map((rule) => ({
    include: rule.include,
    matcher: picomatch(rule.include, { dot: true }),
    transform: rule.transform,
    variants: rule.variants,
    defaultVariant: rule.defaultVariant,
  }))
}

export function findFileRule(
  sourcePath: string,
  files: FilesConfig | undefined,
  compiledRules?: CompiledFileRule[],
): CompiledFileRule | null {
  let rules = compiledRules ?? compileFileRules(files)
  for (let rule of rules) {
    if (rule.matcher(sourcePath)) {
      return rule
    }
  }
  return null
}

export function selectVariant(
  rule: CompiledFileRule,
  requestedVariant: string | undefined,
): string | null {
  if (!rule.variants) {
    return requestedVariant ? null : null
  }

  if (requestedVariant) {
    return rule.variants[requestedVariant] ? requestedVariant : null
  }

  if (rule.defaultVariant) {
    return rule.defaultVariant
  }

  return null
}

export function normalizeSourcePath(sourcePath: string): string {
  return sourcePath
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
}

function getInitialExt(sourcePath: string): string {
  let normalized = normalizeSourcePath(sourcePath)
  let slash = normalized.lastIndexOf('/')
  let filename = slash >= 0 ? normalized.slice(slash + 1) : normalized
  let dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

export async function runFileRule(
  sourcePath: string,
  inputData: Buffer,
  rule: CompiledFileRule,
  selectedVariant: string | undefined,
): Promise<{ data: Buffer; ext: string; variant: string | undefined }> {
  let data = inputData
  let ext = getInitialExt(sourcePath)
  let context = { sourcePath, ext }

  if (rule.transform) {
    let result = await rule.transform(data, context)
    if (Buffer.isBuffer(result)) {
      data = result
    } else {
      data = await result.data
      ext = result.ext ?? ext
    }
    context = { sourcePath, ext }
  }

  if (rule.variants && selectedVariant) {
    let transform = rule.variants[selectedVariant]
    let result = await transform(data, context)
    if (Buffer.isBuffer(result)) {
      data = result
    } else {
      data = await result.data
      ext = result.ext ?? ext
    }
  }

  return { data, ext, variant: selectedVariant }
}
