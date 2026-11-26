import * as fs from 'node:fs'
import type { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

import { getModuleFormat } from './package-type.ts'
import {
  appendNamespaceToUrl,
  createScopedSpecifier,
  getNamespace,
  parseScopedSpecifier,
} from './request.ts'
import { transformModule } from './transform.ts'

type ModuleHooks = Parameters<typeof registerHooks>[0]
type LoadHook = NonNullable<ModuleHooks['load']>
type ResolveHook = NonNullable<ModuleHooks['resolve']>

/**
 * Transforms `.ts`, `.tsx`, and `.jsx` modules into runnable JavaScript for Node's `load` hook API.
 *
 * @param url Module URL being loaded by Node.
 * @param context Hook context for the current load request.
 * @param nextLoad Continuation for delegating to the next registered hook.
 * @returns The transformed module source for supported TypeScript/JSX files, or the delegated result.
 */
export const load: LoadHook = (url, context, nextLoad) => {
  if (url.startsWith('file:')) {
    let filePath = fileURLToPath(url)
    if (isTransformableFile(filePath)) {
      let source = fs.readFileSync(filePath, 'utf8')
      return {
        format: getModuleFormat(filePath, source),
        shortCircuit: true,
        source: transformModule(filePath, source),
      }
    }
  }

  return nextLoad(url, context)
}

export function createScopedHooks(namespace: string): { load: LoadHook; resolve: ResolveHook } {
  return {
    load(url, context, nextLoad) {
      return getNamespace(url) === namespace ? load(url, context, nextLoad) : nextLoad(url, context)
    },
    resolve(specifier, context, nextResolve) {
      let scopedRequest = parseScopedSpecifier(specifier)
      let requestNamespace =
        scopedRequest?.namespace ?? getNamespace(specifier) ?? getNamespace(context.parentURL)

      if (requestNamespace !== namespace) {
        return nextResolve(specifier, context)
      }

      let resolved = nextResolve(scopedRequest?.specifier ?? specifier, {
        ...context,
        parentURL: scopedRequest?.parentURL ?? context.parentURL,
      })

      if (resolved.format === 'builtin' || !resolved.url.startsWith('file:')) {
        return resolved
      }

      return {
        ...resolved,
        url: appendNamespaceToUrl(resolved.url, namespace),
      }
    },
  }
}

export function createLoadModuleSpecifier(
  specifier: string,
  parentURL: string,
  namespace: string,
): string {
  return createScopedSpecifier({ namespace, parentURL, specifier })
}

function isTransformableFile(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
}
