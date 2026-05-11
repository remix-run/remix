import { transform } from 'esbuild'
import { getTsconfig, type TsConfigResult } from 'get-tsconfig'
import * as fs from 'node:fs'
import * as path from 'node:path'

const tsconfigCache = new Map<string, TsConfigResult | null>()
const packageTypeCache = new Map<string, 'commonjs' | 'module' | null>()

/*
 * Transform a TypeScript file to JavaScript using esbuild with an inline
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
): Promise<{ code: string; format: 'commonjs' | 'module' }> {
  let format = getModuleFormat(filePath)
  let loader: 'ts' | 'tsx' = filePath.endsWith('.tsx') ? 'tsx' : 'ts'

  let tsConfig = getTsconfig(path.dirname(filePath), 'tsconfig.json', tsconfigCache)

  let result = await transform(source, {
    format: format === 'module' ? 'esm' : 'cjs',
    loader,
    sourcemap: 'inline',
    sourcesContent: true,
    sourcefile: filePath,
    tsconfigRaw: { compilerOptions: tsConfig?.config.compilerOptions ?? {} },
  })
  return { code: result.code, format }
}

function getModuleFormat(filePath: string): 'commonjs' | 'module' {
  let directory = path.dirname(filePath)

  while (true) {
    if (packageTypeCache.has(directory)) {
      let cachedPackageType = packageTypeCache.get(directory)
      if (cachedPackageType != null) {
        return cachedPackageType
      }

      let parentDirectory = path.dirname(directory)
      if (parentDirectory === directory || path.basename(directory) === 'node_modules') {
        return 'commonjs'
      }

      directory = parentDirectory
      continue
    }

    let packageType = readPackageType(path.join(directory, 'package.json'))
    packageTypeCache.set(directory, packageType)
    if (packageType != null) {
      return packageType
    }

    if (path.basename(directory) === 'node_modules') {
      return 'commonjs'
    }

    let parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) {
      return 'commonjs'
    }

    directory = parentDirectory
  }
}

function readPackageType(packageJsonPath: string): 'commonjs' | 'module' | null {
  try {
    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (!isRecord(packageJson)) {
      throw new Error(`Invalid package.json at ${packageJsonPath}. Expected an object.`)
    }

    return packageJson.type === 'module' ? 'module' : 'commonjs'
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT' || nodeError.code === 'ENOTDIR') {
      return null
    }

    throw error
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
