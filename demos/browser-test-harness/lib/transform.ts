import * as esbuild from 'esbuild'
import * as fs from 'node:fs/promises'

let transformCache = new Map<string, string>()

export async function transformFile(filePath: string): Promise<string> {
  if (transformCache.has(filePath)) {
    return transformCache.get(filePath)!
  }

  try {
    let source = await fs.readFile(filePath, 'utf-8')

    source = source
      .replace(/import\s+.*?\s+from\s+['"]node:test['"]\s*;?\s*/g, '')
      .replace(/import\s+.*?\s+from\s+['"]node:assert\/strict['"]\s*;?\s*/g, '')

    let result = await esbuild.transform(source, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      sourcemap: 'inline',
      sourcefile: filePath,
      tsconfigRaw: {
        compilerOptions: {
          verbatimModuleSyntax: true,
          experimentalDecorators: false,
        },
      },
    })

    let code = result.code.replace(/__name/g, '(() => {})')

    transformCache.set(filePath, code)
    return code
  } catch (error: any) {
    console.error(`Transform error in ${filePath}:`, error)
    return `throw new Error('Transform error: ${error.message?.replace(/'/g, "\\'")}');`
  }
}

export async function bundleFile(filePath: string): Promise<string> {
  let cacheKey = `bundle:${filePath}`
  if (transformCache.has(cacheKey)) {
    return transformCache.get(cacheKey)!
  }

  try {
    let result = await esbuild.build({
      entryPoints: [filePath],
      bundle: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      sourcemap: 'inline',
      write: false,
      tsconfigRaw: {
        compilerOptions: {
          verbatimModuleSyntax: true,
          experimentalDecorators: false,
          jsx: 'react-jsx',
          jsxImportSource: 'remix/component',
        },
      },
    })

    let code = result.outputFiles[0].text.replace(/__name/g, '(() => {})')
    transformCache.set(cacheKey, code)
    return code
  } catch (error: any) {
    console.error(`Bundle error in ${filePath}:`, error)
    return `throw new Error('Bundle error: ${error.message?.replace(/'/g, "\\'")}');`
  }
}

export function clearCache() {
  transformCache.clear()
}
