import { transformSync, type TransformOptions } from 'oxc-transform'
import { getTsconfig, type TsConfigResult } from 'get-tsconfig'
import * as path from 'node:path'

import { getModuleFormat, type ModuleFormat } from './package-type.ts'

const tsconfigCache = new Map<string, TsConfigResult | null>()
const supportedTsconfigTransformCompilerOptions = {
  jsx: 'jsx',
  jsxFactory: 'jsxFactory',
  jsxFragmentFactory: 'jsxFragmentFactory',
  jsxImportSource: 'jsxImportSource',
} as const

export function transformModule(filePath: string, source: string): string {
  let compilerOptions = getTsconfigCompilerOptions(filePath)
  let result = transformSync(filePath, source, {
    lang: getLanguage(filePath),
    sourceType: getSourceType(filePath),
    sourcemap: true,
    ...getJsxTransformOptions(filePath, compilerOptions),
  })

  if (result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  }

  if (result.map == null) {
    return result.code
  }

  return `${result.code}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(
    JSON.stringify(result.map),
  ).toString('base64')}`
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

function getTsconfigCompilerOptions(filePath: string): Record<string, unknown> | undefined {
  let parsed = getTsconfig(path.dirname(filePath), 'tsconfig.json', tsconfigCache)
  if (parsed == null) {
    return undefined
  }

  let compilerOptions = parsed.config.compilerOptions
  return typeof compilerOptions === 'object' && compilerOptions !== null
    ? (compilerOptions as Record<string, unknown>)
    : undefined
}

function getJsxTransformOptions(
  filePath: string,
  compilerOptions?: Record<string, unknown>,
): Pick<TransformOptions, 'jsx'> {
  let jsx = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsx)
  let importSource = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxImportSource,
  )
  let factory = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxFactory,
  )
  let fragment = getStringOption(
    compilerOptions,
    supportedTsconfigTransformCompilerOptions.jsxFragmentFactory,
  )

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

function getStringOption(
  compilerOptions: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  let value = compilerOptions?.[key]
  return typeof value === 'string' ? value : undefined
}
