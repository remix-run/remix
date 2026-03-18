import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import * as ts from 'typescript'

export interface TsconfigTransformOptions {
  cacheKey: string
  tsconfigRaw?: { compilerOptions: Record<string, unknown> }
}

interface CachedTransformOptions {
  configFiles: string[]
  configStamp: string
  result: TsconfigTransformOptions
}

let configPathByDirectory = new Map<string, string | null>()
let transformOptionsByConfigPath = new Map<string, CachedTransformOptions>()

export let typescriptVersion = ts.version

export function getTsconfigTransformOptions(filePath: string): TsconfigTransformOptions {
  let directory = path.dirname(filePath)
  let configPath = getTsconfigPathForDirectory(directory)
  if (!configPath) {
    return { cacheKey: 'null' }
  }

  let cached = transformOptionsByConfigPath.get(configPath)
  if (cached && cached.configStamp === getConfigStamp(cached.configFiles)) {
    return cached.result
  }

  let loaded = loadCompilerOptionsConfig(configPath)
  let converted = ts.convertCompilerOptionsFromJson(
    loaded.compilerOptions,
    path.dirname(configPath),
    configPath,
  )
  if (converted.errors.length > 0) {
    throw new Error(ts.flattenDiagnosticMessageText(converted.errors[0].messageText, '\n'))
  }

  let tsconfigRaw = toEsbuildTsconfigRaw(converted.options)
  let result: TsconfigTransformOptions = {
    cacheKey: JSON.stringify(tsconfigRaw?.compilerOptions ?? null),
    tsconfigRaw,
  }

  transformOptionsByConfigPath.set(configPath, {
    configFiles: loaded.configFiles,
    configStamp: getConfigStamp(loaded.configFiles),
    result,
  })

  return result
}

function getTsconfigPathForDirectory(directory: string): string | null {
  let cached = configPathByDirectory.get(directory)
  if (cached !== undefined) {
    return cached
  }

  let configPath = ts.findConfigFile(directory, ts.sys.fileExists, 'tsconfig.json')
  let normalizedConfigPath = configPath ? path.resolve(configPath) : null
  configPathByDirectory.set(directory, normalizedConfigPath)
  return normalizedConfigPath
}

function getConfigStamp(configFiles: string[]): string {
  return configFiles
    .map((configFile) => {
      try {
        let stat = fs.statSync(configFile)
        return `${configFile}:${stat.size}:${stat.mtimeMs}`
      } catch {
        return `${configFile}:missing`
      }
    })
    .join('|')
}

function loadCompilerOptionsConfig(
  configPath: string,
  seen = new Set<string>(),
): { compilerOptions: Record<string, unknown>; configFiles: string[] } {
  let normalizedConfigPath = path.resolve(configPath)
  if (seen.has(normalizedConfigPath)) {
    throw new Error(`Circular tsconfig extends detected at ${normalizedConfigPath}`)
  }

  seen.add(normalizedConfigPath)

  let configFile = ts.readConfigFile(normalizedConfigPath, ts.sys.readFile)
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
  }

  let configFiles = new Set([normalizedConfigPath])
  let compilerOptions: Record<string, unknown> = {}
  let config = isObjectRecord(configFile.config) ? configFile.config : {}

  for (let extendsValue of getExtendsValues(config.extends)) {
    let extendedConfigPath = resolveExtendedConfigPath(extendsValue, normalizedConfigPath)
    let loaded = loadCompilerOptionsConfig(extendedConfigPath, seen)
    for (let file of loaded.configFiles) {
      configFiles.add(file)
    }
    Object.assign(compilerOptions, loaded.compilerOptions)
  }

  if (isObjectRecord(config.compilerOptions)) {
    Object.assign(compilerOptions, config.compilerOptions)
  }

  seen.delete(normalizedConfigPath)

  return {
    compilerOptions,
    configFiles: [...configFiles],
  }
}

function getExtendsValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string')
  return []
}

function resolveExtendedConfigPath(extendsValue: string, fromConfigPath: string): string {
  let fromDirectory = path.dirname(fromConfigPath)

  if (path.isAbsolute(extendsValue) || extendsValue.startsWith('.')) {
    return resolveConfigLikePath(path.resolve(fromDirectory, extendsValue))
  }

  let requireFromConfig = createRequire(path.join(fromDirectory, '__tsconfig__.js'))
  let candidates = [extendsValue, `${extendsValue}.json`, `${extendsValue}/tsconfig.json`]

  for (let candidate of candidates) {
    try {
      return path.resolve(requireFromConfig.resolve(candidate))
    } catch {
      continue
    }
  }

  throw new Error(`Unable to resolve tsconfig extends "${extendsValue}" from ${fromConfigPath}`)
}

function resolveConfigLikePath(candidatePath: string): string {
  let normalizedCandidatePath = path.resolve(candidatePath)
  let candidates = [
    normalizedCandidatePath,
    `${normalizedCandidatePath}.json`,
    path.join(normalizedCandidatePath, 'tsconfig.json'),
  ]

  for (let candidate of candidates) {
    try {
      let stat = fs.statSync(candidate)
      if (stat.isFile()) return candidate
    } catch {
      continue
    }
  }

  throw new Error(`Unable to resolve tsconfig file at ${candidatePath}`)
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toEsbuildTsconfigRaw(options: ts.CompilerOptions) {
  let compilerOptions: Record<string, unknown> = {}

  switch (options.jsx) {
    case ts.JsxEmit.Preserve:
      compilerOptions.jsx = 'preserve'
      break
    case ts.JsxEmit.React:
      compilerOptions.jsx = 'react'
      break
    case ts.JsxEmit.ReactJSX:
      compilerOptions.jsx = 'react-jsx'
      break
    case ts.JsxEmit.ReactJSXDev:
      compilerOptions.jsx = 'react-jsxdev'
      break
  }

  if (options.jsxFactory) compilerOptions.jsxFactory = options.jsxFactory
  if (options.jsxFragmentFactory) {
    compilerOptions.jsxFragmentFactory = options.jsxFragmentFactory
  }
  if (options.jsxImportSource) compilerOptions.jsxImportSource = options.jsxImportSource
  if (options.experimentalDecorators !== undefined) {
    compilerOptions.experimentalDecorators = options.experimentalDecorators
  }
  if (options.useDefineForClassFields !== undefined) {
    compilerOptions.useDefineForClassFields = options.useDefineForClassFields
  }
  if (options.alwaysStrict !== undefined) {
    compilerOptions.alwaysStrict = options.alwaysStrict
  }
  if (options.verbatimModuleSyntax !== undefined) {
    compilerOptions.verbatimModuleSyntax = options.verbatimModuleSyntax
  }
  if (options.preserveValueImports !== undefined) {
    compilerOptions.preserveValueImports = options.preserveValueImports
  }

  switch (options.importsNotUsedAsValues) {
    case ts.ImportsNotUsedAsValues.Remove:
      compilerOptions.importsNotUsedAsValues = 'remove'
      break
    case ts.ImportsNotUsedAsValues.Preserve:
      compilerOptions.importsNotUsedAsValues = 'preserve'
      break
    case ts.ImportsNotUsedAsValues.Error:
      compilerOptions.importsNotUsedAsValues = 'error'
      break
  }

  return Object.keys(compilerOptions).length > 0 ? { compilerOptions } : undefined
}
