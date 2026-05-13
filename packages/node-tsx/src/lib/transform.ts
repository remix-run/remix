import { transformSync, type OxcError, type TransformOptions } from 'oxc-transform'
import { getTsconfig, type TsConfigResult } from 'get-tsconfig'
import * as path from 'node:path'

import { getModuleFormat, type ModuleFormat } from './package-type.ts'

const tsconfigCache = new Map<string, TsConfigResult | null>()
const tsconfigTransformCompilerOptionKeys = [
  'jsx',
  'jsxFactory',
  'jsxFragmentFactory',
  'jsxImportSource',
] as const

type TsconfigTransformCompilerOptionKey = (typeof tsconfigTransformCompilerOptionKeys)[number]

type TsconfigTransformCompilerOptions = {
  [key in TsconfigTransformCompilerOptionKey]?: string
}

type TsconfigTransformCompilerOptionsIssue = {
  key: TsconfigTransformCompilerOptionKey
  value: unknown
}

export function transformModule(filePath: string, source: string): string {
  let compilerOptions = getTsconfigCompilerOptions(filePath)
  let result = transformSync(filePath, source, {
    lang: getLanguage(filePath),
    sourceType: getSourceType(filePath),
    sourcemap: true,
    ...getJsxTransformOptions(filePath, compilerOptions),
  })

  if (result.errors.length > 0) {
    throw createTransformError(result.errors)
  }

  if (result.map == null) {
    return result.code
  }

  return `${result.code}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(
    JSON.stringify(result.map),
  ).toString('base64')}`
}

function createTransformError(errors: OxcError[]): SyntaxError {
  let message = errors.map((error) => error.message).join('\n')
  let error = new SyntaxError(message)
  error.stack = errors.map(formatTransformError).join('\n\n')
  return error
}

function formatTransformError(error: OxcError): string {
  let sections = [error.codeframe?.trimEnd() ?? error.message, `SyntaxError: ${error.message}`]

  if (error.helpMessage != null) {
    sections.push(error.helpMessage)
  }

  return sections.join('\n\n')
}

function getSourceType(filePath: string): NonNullable<TransformOptions['sourceType']> {
  return getModuleFormatForTransform(filePath) === 'module' ? 'module' : 'commonjs'
}

function getModuleFormatForTransform(filePath: string): ModuleFormat {
  return filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
    ? (getModuleFormat(filePath) as ModuleFormat)
    : 'module'
}

function getLanguage(filePath: string): NonNullable<TransformOptions['lang']> {
  return filePath.endsWith('.tsx') ? 'tsx' : 'jsx'
}

function getTsconfigCompilerOptions(filePath: string): TsconfigTransformCompilerOptions | undefined {
  let parsed = getTsconfig(path.dirname(filePath), 'tsconfig.json', tsconfigCache)
  if (parsed == null) {
    return undefined
  }

  let compilerOptions = parsed.config.compilerOptions
  if (typeof compilerOptions !== 'object' || compilerOptions === null) {
    return undefined
  }

  return parseTsconfigTransformCompilerOptions(
    filePath,
    compilerOptions as Record<string, unknown>,
  )
}

function parseTsconfigTransformCompilerOptions(
  filePath: string,
  compilerOptions: Record<string, unknown>,
): TsconfigTransformCompilerOptions {
  let options: TsconfigTransformCompilerOptions = {}
  let issues: TsconfigTransformCompilerOptionsIssue[] = []

  for (let key of tsconfigTransformCompilerOptionKeys) {
    let value = compilerOptions[key]
    if (value === undefined) {
      continue
    }

    if (typeof value !== 'string') {
      issues.push({ key, value })
      continue
    }

    options[key] = value
  }

  if (issues.length > 0) {
    throw createTsconfigCompilerOptionsError(filePath, issues)
  }

  return options
}

function createTsconfigCompilerOptionsError(
  filePath: string,
  issues: TsconfigTransformCompilerOptionsIssue[],
): Error {
  let details = issues.map(formatTsconfigCompilerOptionsIssue).join('\n')
  return new Error(
    `Invalid tsconfig compilerOptions for ${filePath}.\n` +
      `remix/node-tsx only supports string values for JSX transform options.\n${details}`,
  )
}

function formatTsconfigCompilerOptionsIssue(
  issue: TsconfigTransformCompilerOptionsIssue,
): string {
  return `- compilerOptions.${issue.key}: Expected string, received ${getValueType(issue.value)}`
}

function getValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array'
  }

  if (value === null) {
    return 'null'
  }

  return typeof value
}

function getJsxTransformOptions(
  filePath: string,
  compilerOptions?: TsconfigTransformCompilerOptions,
): Pick<TransformOptions, 'jsx'> {
  let jsx = compilerOptions?.jsx
  let importSource = compilerOptions?.jsxImportSource
  let factory = compilerOptions?.jsxFactory
  let fragment = compilerOptions?.jsxFragmentFactory

  if (jsx === 'preserve' || jsx === 'react-native') {
    throw new Error(
      `Unsupported tsconfig compilerOptions.jsx = "${jsx}" for ${filePath}. ` +
        'remix/node-tsx must compile JSX to runnable JavaScript.',
    )
  }

  if (jsx == null || jsx === 'react-jsx' || jsx === 'react-jsxdev') {
    return {
      jsx: {
        development: jsx === 'react-jsxdev',
        importSource,
        runtime: 'automatic',
      },
    }
  }

  return {
    jsx: {
      pragma: factory,
      pragmaFrag: fragment,
      runtime: 'classic',
    },
  }
}
