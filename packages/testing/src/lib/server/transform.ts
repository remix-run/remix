import * as esbuild from 'esbuild'

let cache = new Map<string, string>()

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
      jsxImportSource: '@remix-run/component',
    },
  },
} as const

export async function bundleFile(
  filePath: string,
  opts: { absWorkingDir?: string; cache?: boolean } = {},
): Promise<string> {
  let cacheKey = [filePath, opts.absWorkingDir ?? ''].join(':')
  if (opts.cache == false && cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }

  try {
    let result = await esbuild.build({
      ...esbuildOpts,
      entryPoints: [filePath],
      absWorkingDir: opts.absWorkingDir,
      bundle: true,
      external: ['remix/*', '@remix-run/*'],
      write: false,
    })

    let code = result.outputFiles[0].text.replace(/__name/g, '(() => {})')
    if (opts.cache !== false) {
      cache.set(cacheKey, code)
    }
    return code
  } catch (error: any) {
    console.error(`Bundle error in ${filePath}:`, error)
    return `throw new Error('Bundle error: ${error.message?.replace(/'/g, "\\'")}');`
  }
}

export function clearCache() {
  cache.clear()
}
