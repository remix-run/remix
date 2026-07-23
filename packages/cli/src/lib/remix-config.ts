import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  findNodeAtLocation,
  parse,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser'

import { invalidRemixConfig, remixConfigNotFound } from './errors.ts'

const reporters = ['spec', 'files', 'tap', 'dot'] as const
const testPools = ['forks', 'threads'] as const
const testTypes = ['server', 'browser', 'e2e'] as const

type Reporter = (typeof reporters)[number]
type TestPool = (typeof testPools)[number]
type TestType = (typeof testTypes)[number]
type JsonPath = Array<number | string>

export interface RemixConfig {
  test?: RemixTestCommandConfig
}

export interface RemixTestCommandConfig {
  browserFiles?: string[]
  concurrency?: number
  coverage?: {
    branches?: number
    dir?: string
    enabled?: boolean
    exclude?: string[]
    functions?: number
    include?: string[]
    lines?: number
    statements?: number
  }
  e2eFiles?: string[]
  exclude?: string[]
  files?: string[]
  only?: string[]
  playwright?: {
    configFile?: string
    echo?: boolean
    open?: boolean
    projects?: string[]
  }
  pool?: TestPool
  quiet?: boolean
  reporter?: Reporter
  setup?: string
  type?: TestType[]
  watch?: boolean
}

interface ConfigSource {
  filePath: string
  root: JsonNode | undefined
  text: string
}

export async function loadRemixConfig(
  cwd: string,
  configPath: string | undefined,
): Promise<RemixConfig> {
  let filePath = path.resolve(cwd, configPath ?? 'remix.json')
  let text: string

  try {
    text = await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      if (configPath === undefined) return {}
      throw remixConfigNotFound(filePath)
    }

    throw error
  }

  let parseErrors: ParseError[] = []
  let value: unknown = parse(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  })
  let root = parseTree(text, [], {
    allowTrailingComma: true,
    disallowComments: false,
  })
  let source = { filePath, root, text }

  if (parseErrors.length > 0) {
    let error = parseErrors[0]!
    throwConfigError(source, [], printParseErrorCode(error.error), error.offset)
  }

  return parseConfig(value, source, path.dirname(filePath), cwd)
}

function parseConfig(
  value: unknown,
  source: ConfigSource,
  configDir: string,
  cwd: string,
): RemixConfig {
  let object = requireObject(value, source, [])
  requireKnownProperties(object, ['$schema', 'test'], source, [])

  if (object.$schema !== undefined) {
    requireString(object.$schema, source, ['$schema'])
  }

  return object.test === undefined
    ? {}
    : { test: parseTestConfig(object.test, source, configDir, cwd) }
}

function parseTestConfig(
  value: unknown,
  source: ConfigSource,
  configDir: string,
  cwd: string,
): RemixTestCommandConfig {
  let objectPath = ['test']
  let object = requireObject(value, source, objectPath)
  requireKnownProperties(
    object,
    [
      'browserFiles',
      'concurrency',
      'coverage',
      'e2eFiles',
      'exclude',
      'files',
      'only',
      'playwright',
      'pool',
      'quiet',
      'reporter',
      'setup',
      'type',
      'watch',
    ],
    source,
    objectPath,
  )

  let config: RemixTestCommandConfig = {}
  let browserFiles = optionalStringArray(object.browserFiles, source, [
    ...objectPath,
    'browserFiles',
  ])
  let e2eFiles = optionalStringArray(object.e2eFiles, source, [...objectPath, 'e2eFiles'])
  let exclude = optionalStringArray(object.exclude, source, [...objectPath, 'exclude'])
  let files = optionalStringArray(object.files, source, [...objectPath, 'files'])
  let only = optionalStringArray(object.only, source, [...objectPath, 'only'])
  let concurrency = optionalNumber(object.concurrency, source, [...objectPath, 'concurrency'])
  let setup = optionalString(object.setup, source, [...objectPath, 'setup'])

  if (browserFiles !== undefined) config.browserFiles = resolveGlobs(browserFiles, configDir, cwd)
  if (e2eFiles !== undefined) config.e2eFiles = resolveGlobs(e2eFiles, configDir, cwd)
  if (exclude !== undefined) config.exclude = resolveGlobs(exclude, configDir, cwd)
  if (files !== undefined) config.files = resolveGlobs(files, configDir, cwd)
  if (only !== undefined) {
    for (let [index, pattern] of only.entries()) {
      validateOnlyPattern(pattern, source, [...objectPath, 'only', index])
    }
    config.only = only
  }

  if (concurrency !== undefined) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throwConfigError(source, [...objectPath, 'concurrency'], 'Expected a positive integer')
    }
    config.concurrency = concurrency
  }

  let pool = optionalEnum(object.pool, testPools, source, [...objectPath, 'pool'])
  if (pool !== undefined) config.pool = pool

  let quiet = optionalBoolean(object.quiet, source, [...objectPath, 'quiet'])
  if (quiet !== undefined) config.quiet = quiet

  let reporter = optionalEnum(object.reporter, reporters, source, [...objectPath, 'reporter'])
  if (reporter !== undefined) config.reporter = reporter

  if (setup !== undefined) config.setup = path.resolve(configDir, setup)

  let type = optionalEnumArray(object.type, testTypes, source, [...objectPath, 'type'])
  if (type !== undefined) config.type = type

  let watch = optionalBoolean(object.watch, source, [...objectPath, 'watch'])
  if (watch !== undefined) config.watch = watch

  if (object.coverage !== undefined) {
    config.coverage = parseCoverageConfig(object.coverage, source, configDir, cwd)
  }

  if (object.playwright !== undefined) {
    config.playwright = parsePlaywrightConfig(object.playwright, source, configDir)
  }

  return config
}

function parseCoverageConfig(
  value: unknown,
  source: ConfigSource,
  configDir: string,
  cwd: string,
): NonNullable<RemixTestCommandConfig['coverage']> {
  let objectPath = ['test', 'coverage']
  let object = requireObject(value, source, objectPath)
  requireKnownProperties(
    object,
    ['branches', 'dir', 'enabled', 'exclude', 'functions', 'include', 'lines', 'statements'],
    source,
    objectPath,
  )

  let config: NonNullable<RemixTestCommandConfig['coverage']> = {}
  let branches = optionalNumber(object.branches, source, [...objectPath, 'branches'])
  let dir = optionalString(object.dir, source, [...objectPath, 'dir'])
  let enabled = optionalBoolean(object.enabled, source, [...objectPath, 'enabled'])
  let exclude = optionalStringArray(object.exclude, source, [...objectPath, 'exclude'])
  let functions = optionalNumber(object.functions, source, [...objectPath, 'functions'])
  let include = optionalStringArray(object.include, source, [...objectPath, 'include'])
  let lines = optionalNumber(object.lines, source, [...objectPath, 'lines'])
  let statements = optionalNumber(object.statements, source, [...objectPath, 'statements'])

  if (branches !== undefined) config.branches = branches
  if (dir !== undefined) config.dir = path.resolve(configDir, dir)
  if (enabled !== undefined) config.enabled = enabled
  if (exclude !== undefined) config.exclude = resolveGlobs(exclude, configDir, cwd)
  if (functions !== undefined) config.functions = functions
  if (include !== undefined) config.include = resolveGlobs(include, configDir, cwd)
  if (lines !== undefined) config.lines = lines
  if (statements !== undefined) config.statements = statements

  return config
}

function parsePlaywrightConfig(
  value: unknown,
  source: ConfigSource,
  configDir: string,
): NonNullable<RemixTestCommandConfig['playwright']> {
  let objectPath = ['test', 'playwright']
  let object = requireObject(value, source, objectPath)
  requireKnownProperties(object, ['configFile', 'echo', 'open', 'projects'], source, objectPath)

  let config: NonNullable<RemixTestCommandConfig['playwright']> = {}
  let configFile = optionalString(object.configFile, source, [...objectPath, 'configFile'])
  let echo = optionalBoolean(object.echo, source, [...objectPath, 'echo'])
  let open = optionalBoolean(object.open, source, [...objectPath, 'open'])
  let projects = optionalStringArray(object.projects, source, [...objectPath, 'projects'])

  if (configFile !== undefined) config.configFile = path.resolve(configDir, configFile)
  if (echo !== undefined) config.echo = echo
  if (open !== undefined) config.open = open
  if (projects !== undefined) config.projects = projects

  return config
}

function requireObject(
  value: unknown,
  source: ConfigSource,
  propertyPath: JsonPath,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throwConfigError(source, propertyPath, 'Expected an object')
  }

  return value
}

function requireKnownProperties(
  object: Record<string, unknown>,
  knownProperties: readonly string[],
  source: ConfigSource,
  propertyPath: JsonPath,
): void {
  for (let property of Object.keys(object)) {
    if (!knownProperties.includes(property)) {
      throwConfigError(source, [...propertyPath, property], `Unknown property "${property}"`)
    }
  }
}

function optionalBoolean(
  value: unknown,
  source: ConfigSource,
  propertyPath: JsonPath,
): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throwConfigError(source, propertyPath, 'Expected a boolean')
  return value
}

function optionalNumber(
  value: unknown,
  source: ConfigSource,
  propertyPath: JsonPath,
): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throwConfigError(source, propertyPath, 'Expected a number')
  }
  return value
}

function optionalString(
  value: unknown,
  source: ConfigSource,
  propertyPath: JsonPath,
): string | undefined {
  if (value === undefined) return undefined
  return requireString(value, source, propertyPath)
}

function requireString(value: unknown, source: ConfigSource, propertyPath: JsonPath): string {
  if (typeof value !== 'string') throwConfigError(source, propertyPath, 'Expected a string')
  return value
}

function optionalStringArray(
  value: unknown,
  source: ConfigSource,
  propertyPath: JsonPath,
): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throwConfigError(source, propertyPath, 'Expected an array of strings')

  return value.map((item, index) => requireString(item, source, [...propertyPath, index]))
}

function optionalEnum<const value extends string>(
  input: unknown,
  values: readonly value[],
  source: ConfigSource,
  propertyPath: JsonPath,
): value | undefined {
  if (input === undefined) return undefined
  let string = requireString(input, source, propertyPath)
  let matched = values.find((value) => value === string)
  if (matched === undefined) {
    throwConfigError(source, propertyPath, `Expected one of: ${values.join(', ')}`)
  }
  return matched
}

function optionalEnumArray<const value extends string>(
  input: unknown,
  values: readonly value[],
  source: ConfigSource,
  propertyPath: JsonPath,
): value[] | undefined {
  if (input === undefined) return undefined
  if (!Array.isArray(input)) throwConfigError(source, propertyPath, 'Expected an array')

  return input.map((item, index) => {
    let itemPath = [...propertyPath, index]
    let string = requireString(item, source, itemPath)
    let matched = values.find((value) => value === string)
    if (matched === undefined) {
      throwConfigError(source, itemPath, `Expected one of: ${values.join(', ')}`)
    }
    return matched
  })
}

function resolveGlobs(values: string[], configDir: string, cwd: string): string[] {
  return values.map((value) => toPosix(path.relative(cwd, path.resolve(configDir, value))))
}

function toPosix(value: string): string {
  return path.sep === '/' ? value : value.replaceAll(path.sep, '/')
}

function validateOnlyPattern(pattern: string, source: ConfigSource, propertyPath: JsonPath): void {
  let regex = parseRegexLiteral(pattern) ?? { flags: 'i', source: pattern }

  try {
    new RegExp(regex.source, regex.flags)
  } catch (error) {
    let reason = error instanceof Error ? error.message : String(error)
    throwConfigError(
      source,
      propertyPath,
      `Expected a valid JavaScript regular expression: ${reason}`,
    )
  }
}

function parseRegexLiteral(pattern: string): { flags: string; source: string } | undefined {
  if (!pattern.startsWith('/') || pattern.length < 2) return undefined

  let escaped = false
  for (let index = pattern.length - 1; index > 0; index--) {
    let char = pattern[index]
    if (char === '/' && !escaped) {
      return {
        flags: pattern.slice(index + 1),
        source: pattern.slice(1, index),
      }
    }
    escaped = char === '\\' && !escaped
  }

  return undefined
}

function throwConfigError(
  source: ConfigSource,
  propertyPath: JsonPath,
  details: string,
  offset?: number,
): never {
  let node = source.root == null ? undefined : findNodeAtLocation(source.root, propertyPath)
  let location = getLineAndColumn(source.text, offset ?? node?.offset ?? 0)
  let label = propertyPath.length === 0 ? '' : ` at ${propertyPath.join('.')}`
  throw invalidRemixConfig(source.filePath, `${details}${label}`, location.line, location.column)
}

function getLineAndColumn(text: string, offset: number): { column: number; line: number } {
  let line = 1
  let column = 1

  for (let index = 0; index < offset; index++) {
    if (text[index] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }

  return { column, line }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
