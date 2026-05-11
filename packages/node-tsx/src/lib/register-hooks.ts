import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { getModuleFormat } from './package-type.ts'
import { appendNamespaceToUrl, getNamespace, parseScopedSpecifier } from './request.ts'
import { transformModule } from './transform.ts'

const scopedState: { namespace?: string } = {}

export function initialize(data?: { namespace?: string }): void {
  scopedState.namespace = data?.namespace
}

export async function load(
  url: string,
  context: { format?: string },
  nextLoad: (
    url: string,
    context: { format?: string },
  ) => Promise<{ format: string; source?: string; url?: string }>,
): Promise<{ format: string; shortCircuit?: true; source?: string; url?: string }> {
  let namespace = scopedState.namespace
  if (namespace != null && getNamespace(url) !== namespace) {
    return nextLoad(url, context)
  }

  if (url.startsWith('file:')) {
    let filePath = fileURLToPath(url)
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      return {
        format: getModuleFormat(filePath),
        shortCircuit: true,
        source: transformModule(filePath, await fs.readFile(filePath, 'utf8')),
      }
    }
  }

  return nextLoad(url, context)
}

export async function resolve(
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (
    specifier: string,
    context: { parentURL?: string },
  ) => Promise<{ format?: string; url: string }>,
): Promise<{ format?: string; url: string }> {
  let namespace = scopedState.namespace
  if (namespace == null) {
    return await nextResolve(specifier, context)
  }

  let scopedRequest = parseScopedSpecifier(specifier)
  let requestNamespace =
    scopedRequest?.namespace ?? getNamespace(specifier) ?? getNamespace(context.parentURL)

  if (requestNamespace !== namespace) {
    return await nextResolve(specifier, context)
  }

  let resolved = await nextResolve(scopedRequest?.specifier ?? specifier, {
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
