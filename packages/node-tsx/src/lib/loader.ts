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

type RegisterHooksOptions = Parameters<typeof registerHooks>[0]

const scopedState: { namespace?: string } = {}

export function initialize(data?: { namespace?: string }): void {
  scopedState.namespace = data?.namespace
}

/**
 * Transforms `.ts`, `.tsx`, and `.jsx` modules into runnable JavaScript for Node's `load` hook API.
 *
 * @param url Module URL being loaded by Node.
 * @param context Hook context for the current load request.
 * @param nextLoad Continuation for delegating to the next registered hook.
 * @returns The transformed module source for supported TypeScript/JSX files, or the delegated result.
 */
export const load: NonNullable<RegisterHooksOptions['load']> = (url, context, nextLoad) => {
  let namespace = scopedState.namespace
  if (namespace != null && getNamespace(url) !== namespace) {
    return nextLoad(url, context)
  }

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

export const resolve: NonNullable<RegisterHooksOptions['resolve']> = (
  specifier,
  context,
  nextResolve,
) => {
  let namespace = scopedState.namespace
  if (namespace == null) {
    return nextResolve(specifier, context)
  }

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
