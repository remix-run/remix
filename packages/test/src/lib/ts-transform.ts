import { getTsconfig, type TsConfigResult } from 'get-tsconfig'
import * as path from 'node:path'
import { transform, type OxcError, type TransformOptions } from 'oxc-transform'

const tsconfigCache = new Map<string, TsConfigResult | null>()

/*
 * Transform a TypeScript file to JavaScript using Oxc with an inline
 * source map and no minification. Used by the coverage ESM loader hook (so V8
 * instruments readable JS), the coverage collector (so byte offsets can be
 * re-derived and mapped back to TypeScript lines), and the browser harness
 * server (so the bytes V8 sees in the browser match what the collector
 * re-derives). Identical inputs must produce identical outputs across all
 * call sites or coverage offsets won't line up.
 *
 * Compiler options (notably JSX) are taken from the nearest `tsconfig.json`
 * walking up from the file's directory, so each project picks up its own
 * `jsxImportSource` etc. Discovery results are cached by directory.
 */
export async function transformTypeScript(
  source: string,
  filePath: string,
): Promise<{ code: string }> {
  let tsConfig = getTsconfig(path.dirname(filePath), 'tsconfig.json', tsconfigCache)
  let compilerOptions = tsConfig?.config.compilerOptions

  let result = await transform(filePath, source, {
    lang: filePath.endsWith('.tsx') ? 'tsx' : 'ts',
    sourceType: 'module',
    sourcemap: true,
    jsx: getJsxTransformOptions(filePath, compilerOptions),
  })

  if (result.errors.length > 0) {
    throw createTransformError(result.errors)
  }

  let code = result.code
  if (result.map) {
    let map = Buffer.from(JSON.stringify(result.map)).toString('base64')
    code += `\n//# sourceMappingURL=data:application/json;base64,${map}`
  }

  return { code }
}

function createTransformError(errors: OxcError[]): SyntaxError {
  return new SyntaxError(errors.map((error) => error.message).join('\n'))
}

function getJsxTransformOptions(
  filePath: string,
  compilerOptions?: Record<string, unknown>,
): TransformOptions['jsx'] | undefined {
  if (!filePath.endsWith('.tsx')) return undefined

  let jsx = getStringOption(compilerOptions, 'jsx')
  let importSource = getStringOption(compilerOptions, 'jsxImportSource')
  let pragma = getStringOption(compilerOptions, 'jsxFactory')
  let pragmaFrag = getStringOption(compilerOptions, 'jsxFragmentFactory')

  if (jsx === 'preserve' || jsx === 'react-native') {
    throw new Error(
      `Unsupported tsconfig compilerOptions.jsx = "${jsx}" for ${filePath}. ` +
        '@remix-run/test must compile JSX to runnable JavaScript.',
    )
  }

  if (jsx === 'react-jsx' || jsx === 'react-jsxdev') {
    return {
      development: jsx === 'react-jsxdev',
      importSource,
      runtime: 'automatic',
    }
  }

  return { pragma, pragmaFrag, runtime: 'classic' }
}

function getStringOption(
  compilerOptions: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  let value = compilerOptions?.[key]
  return typeof value === 'string' ? value : undefined
}
