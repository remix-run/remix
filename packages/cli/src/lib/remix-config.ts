import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  findNodeAtLocation,
  getNodeValue,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from 'jsonc-parser'
import type { RemixTestPool } from '@remix-run/test/cli'

import { invalidRemixConfig, remixConfigNotFound } from './errors.ts'

const reporters = ['spec', 'files', 'tap', 'dot'] as const
const testPools: readonly RemixTestPool[] = ['forks', 'threads']
const testTypes = ['server', 'browser', 'e2e'] as const

type Reporter = (typeof reporters)[number]
type TestPool = RemixTestPool
type TestType = (typeof testTypes)[number]
type JsonPath = Array<number | string>

export interface RemixConfig {
  db?: RemixDbCommandConfig
  doctor?: RemixDoctorCommandConfig
  test?: RemixTestCommandConfig
}

export type RemixDbString = string | { env: string; default?: string }

export type RemixDbAdapterConfig =
  | {
      type: 'sqlite'
      filename: RemixDbString
      foreignKeys?: boolean
      busyTimeout?: number
    }
  | {
      type: 'postgres'
      connectionString: RemixDbString
      maintenanceDatabase?: string
      template?: string
    }
  | {
      type: 'mysql'
      uri: RemixDbString
      characterSet?: string
      collation?: string
    }
  | {
      type: 'module'
      module: string
      export: string
    }

export interface RemixDbCommandConfig {
  adapter: RemixDbAdapterConfig
  migrations?: {
    directory: string
    journalTable?: string
  }
  seed?: {
    module: string
    export: string
  }
}

export interface RemixDoctorCommandConfig {
  strict?: boolean
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

  // Editors saving "UTF-8 with BOM" prefix the file with U+FEFF, which
  // jsonc-parser reports as an InvalidSymbol error.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  let parseErrors: ParseError[] = []
  let root = parseTree(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  })
  let value: unknown = root === undefined ? undefined : getNodeValue(root)
  let source = { filePath, root, text }

  // An empty or comments-only file has no JSON value at all; treat it like a
  // missing file rather than a malformed one.
  if (
    root === undefined &&
    parseErrors.every((error) => printParseErrorCode(error.error) === 'ValueExpected')
  ) {
    return {}
  }

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
  requireKnownProperties(object, ['$schema', 'db', 'doctor', 'test'], source, [])

  if (object.$schema !== undefined) {
    requireString(object.$schema, source, ['$schema'])
  }

  let config: RemixConfig = {}

  if (object.db !== undefined) {
    config.db = parseDbConfig(object.db, source, configDir)
  }

  if (object.doctor !== undefined) {
    config.doctor = parseDoctorConfig(object.doctor, source)
  }

  if (object.test !== undefined) {
    config.test = parseTestConfig(object.test, source, configDir, cwd)
  }

  return config
}

function parseDbConfig(
  value: unknown,
  source: ConfigSource,
  configDir: string,
): RemixDbCommandConfig {
  let objectPath = ['db']
  let object = requireObject(value, source, objectPath)
  requireKnownProperties(object, ['adapter', 'migrations', 'seed'], source, objectPath)

  if (object.adapter === undefined) {
    throwConfigError(source, [...objectPath, 'adapter'], 'Expected an adapter configuration')
  }

  let config: RemixDbCommandConfig = {
    adapter: parseDbAdapterConfig(object.adapter, source, configDir),
  }

  if (object.migrations !== undefined) {
    let migrationsPath = [...objectPath, 'migrations']
    let migrations = requireObject(object.migrations, source, migrationsPath)
    requireKnownProperties(migrations, ['directory', 'journalTable'], source, migrationsPath)
    let directory = requireString(migrations.directory, source, [...migrationsPath, 'directory'])
    let journalTable = optionalString(migrations.journalTable, source, [
      ...migrationsPath,
      'journalTable',
    ])
    config.migrations = {
      directory: path.resolve(configDir, directory),
      journalTable,
    }
  }

  if (object.seed !== undefined) {
    let seedPath = [...objectPath, 'seed']
    let seed = requireObject(object.seed, source, seedPath)
    requireKnownProperties(seed, ['export', 'module'], source, seedPath)
    let module = requireString(seed.module, source, [...seedPath, 'module'])
    let exportName = optionalString(seed.export, source, [...seedPath, 'export']) ?? 'seed'
    config.seed = { module: path.resolve(configDir, module), export: exportName }
  }

  return config
}

function parseDbAdapterConfig(
  value: unknown,
  source: ConfigSource,
  configDir: string,
): RemixDbAdapterConfig {
  let objectPath = ['db', 'adapter']
  let object = requireObject(value, source, objectPath)
  let type = requireEnum(object.type, ['sqlite', 'postgres', 'mysql', 'module'], source, [
    ...objectPath,
    'type',
  ])

  if (type === 'sqlite') {
    requireKnownProperties(
      object,
      ['busyTimeout', 'filename', 'foreignKeys', 'type'],
      source,
      objectPath,
    )
    let busyTimeout = optionalNumber(object.busyTimeout, source, [...objectPath, 'busyTimeout'])
    if (busyTimeout !== undefined && busyTimeout < 0) {
      throwConfigError(source, [...objectPath, 'busyTimeout'], 'Expected a non-negative number')
    }
    return {
      type,
      filename: parseDbString(object.filename, source, [...objectPath, 'filename']),
      foreignKeys: optionalBoolean(object.foreignKeys, source, [...objectPath, 'foreignKeys']),
      busyTimeout,
    }
  }

  if (type === 'postgres') {
    requireKnownProperties(
      object,
      ['connectionString', 'maintenanceDatabase', 'template', 'type'],
      source,
      objectPath,
    )
    return {
      type,
      connectionString: parseDbString(object.connectionString, source, [
        ...objectPath,
        'connectionString',
      ]),
      maintenanceDatabase: optionalString(object.maintenanceDatabase, source, [
        ...objectPath,
        'maintenanceDatabase',
      ]),
      template: optionalString(object.template, source, [...objectPath, 'template']),
    }
  }

  if (type === 'mysql') {
    requireKnownProperties(object, ['characterSet', 'collation', 'type', 'uri'], source, objectPath)
    return {
      type,
      uri: parseDbString(object.uri, source, [...objectPath, 'uri']),
      characterSet: optionalString(object.characterSet, source, [...objectPath, 'characterSet']),
      collation: optionalString(object.collation, source, [...objectPath, 'collation']),
    }
  }

  requireKnownProperties(object, ['export', 'module', 'type'], source, objectPath)
  let module = requireString(object.module, source, [...objectPath, 'module'])
  return {
    type,
    module: path.resolve(configDir, module),
    export: optionalString(object.export, source, [...objectPath, 'export']) ?? 'createDatabase',
  }
}

function parseDbString(
  value: unknown,
  source: ConfigSource,
  propertyPath: JsonPath,
): RemixDbString {
  if (typeof value === 'string') return value

  let object = requireObject(value, source, propertyPath)
  requireKnownProperties(object, ['default', 'env'], source, propertyPath)
  let env = requireString(object.env, source, [...propertyPath, 'env'])
  let defaultValue = optionalString(object.default, source, [...propertyPath, 'default'])
  return defaultValue === undefined ? { env } : { env, default: defaultValue }
}

function parseDoctorConfig(value: unknown, source: ConfigSource): RemixDoctorCommandConfig {
  let objectPath = ['doctor']
  let object = requireObject(value, source, objectPath)
  requireKnownProperties(object, ['strict'], source, objectPath)

  let config: RemixDoctorCommandConfig = {}
  let strict = optionalBoolean(object.strict, source, [...objectPath, 'strict'])
  if (strict !== undefined) config.strict = strict
  return config
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
  return requireEnum(input, values, source, propertyPath)
}

function optionalEnumArray<const value extends string>(
  input: unknown,
  values: readonly value[],
  source: ConfigSource,
  propertyPath: JsonPath,
): value[] | undefined {
  if (input === undefined) return undefined
  if (!Array.isArray(input)) throwConfigError(source, propertyPath, 'Expected an array')

  return input.map((item, index) => requireEnum(item, values, source, [...propertyPath, index]))
}

function requireEnum<const value extends string>(
  input: unknown,
  values: readonly value[],
  source: ConfigSource,
  propertyPath: JsonPath,
): value {
  let string = requireString(input, source, propertyPath)
  let matched = values.find((value) => value === string)
  if (matched === undefined) {
    throwConfigError(source, propertyPath, `Expected one of: ${values.join(', ')}`)
  }
  return matched
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

  // The closing delimiter is the last unescaped slash; escape state must be
  // tracked left-to-right since it depends on the preceding backslashes.
  let closingIndex = -1
  let escaped = false
  for (let index = 1; index < pattern.length; index++) {
    if (escaped) {
      escaped = false
    } else if (pattern[index] === '\\') {
      escaped = true
    } else if (pattern[index] === '/') {
      closingIndex = index
    }
  }

  if (closingIndex === -1) return undefined

  return {
    flags: pattern.slice(closingIndex + 1),
    source: pattern.slice(1, closingIndex),
  }
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
