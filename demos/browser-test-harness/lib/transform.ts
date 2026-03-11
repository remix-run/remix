import * as esbuild from 'esbuild'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

let transformCache = new Map<string, string>()

const esbuildOpts = {
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  sourcemap: 'inline',
  tsconfigRaw: {
    compilerOptions: {
      verbatimModuleSyntax: true,
      experimentalDecorators: false,
      jsx: 'react-jsx',
      jsxImportSource: 'remix/component',
    },
  },
} as const

export async function transformFile(filePath: string): Promise<string> {
  if (transformCache.has(filePath)) {
    return transformCache.get(filePath)!
  }

  try {
    let source = await fs.readFile(filePath, 'utf-8')

    let ext = path.extname(filePath)
    let result = await esbuild.transform(source, {
      ...esbuildOpts,
      loader: ext === '.tsx' ? 'tsx' : ext === '.jsx' ? 'jsx' : 'ts',
      sourcefile: filePath,
    })
    let code = result.code

    code = code.replace(/__name/g, '(() => {})')
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
      ...esbuildOpts,
      entryPoints: [filePath],
      bundle: true,
      external: ['remix/*'],
      write: false,
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
