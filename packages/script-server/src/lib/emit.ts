import MagicString from 'magic-string'

import {
  createScriptServerCompilationError,
  isScriptServerCompilationError,
} from './compilation-error.ts'
import { hashContent } from './fingerprint.ts'
import type { ResolvedModule } from './resolve.ts'
import { composeSourceMaps } from './source-maps.ts'
import type { ScriptServerCompilationError } from './compilation-error.ts'

export type EmittedModule = {
  compiledCode: string
  compiledHash: string
  fingerprint: string
  importUrls: string[]
  sourcemap: string | null
  sourcemapHash: string | null
}

type EmitResult =
  | {
      ok: true
      value: EmittedModule
    }
  | {
      ok: false
      error: ScriptServerCompilationError
    }

export async function emitResolvedModule(
  resolvedModule: ResolvedModule,
  options: {
    getServedUrl(identityPath: string): Promise<string>
    sourceMaps?: 'external' | 'inline'
  },
): Promise<EmitResult> {
  try {
    let importUrls = await Promise.all(
      resolvedModule.deps.map((depPath) => options.getServedUrl(depPath)),
    )
    let rewriteResult = await rewriteImports(resolvedModule, options)
    let finalCode = rewriteResult.code

    if (rewriteResult.sourcemap) {
      if (options.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourcemap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (options.sourceMaps === 'external') {
        finalCode += `\n//# sourceMappingURL=${await options.getServedUrl(resolvedModule.identityPath)}.map`
      }
    }

    return {
      ok: true,
      value: {
        compiledCode: finalCode,
        compiledHash: await hashContent(finalCode),
        fingerprint: resolvedModule.fingerprint,
        importUrls,
        sourcemap: rewriteResult.sourcemap,
        sourcemapHash: rewriteResult.sourcemap ? await hashContent(rewriteResult.sourcemap) : null,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: toEmitError(error, resolvedModule.identityPath),
    }
  }
}

async function rewriteImports(
  resolvedModule: ResolvedModule,
  options: {
    getServedUrl(identityPath: string): Promise<string>
  },
): Promise<{ code: string; sourcemap: string | null }> {
  let rewrittenSource = new MagicString(resolvedModule.rawCode)

  for (let imported of resolvedModule.imports) {
    let url = await options.getServedUrl(imported.depPath)
    rewrittenSource.overwrite(
      imported.start,
      imported.end,
      imported.quote ? `${imported.quote}${url}${imported.quote}` : url,
    )
  }

  let code = rewrittenSource.toString()
  let sourcemap =
    resolvedModule.sourcemap && resolvedModule.imports.length > 0
      ? composeSourceMaps(
          rewrittenSource.generateMap({ hires: true }).toString(),
          resolvedModule.sourcemap,
        )
      : resolvedModule.sourcemap

  return { code, sourcemap }
}

function toEmitError(error: unknown, identityPath: string): ScriptServerCompilationError {
  if (isScriptServerCompilationError(error)) return error

  return createScriptServerCompilationError(
    `Failed to emit module ${identityPath}.\n\n${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'MODULE_EMIT_FAILED',
    },
  )
}
