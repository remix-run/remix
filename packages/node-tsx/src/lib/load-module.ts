import { register } from 'node:module'
import * as path from 'node:path'
import * as process from 'node:process'
import { pathToFileURL } from 'node:url'

import { createLoadModuleSpecifier } from './loader.ts'

export async function loadModule(specifier: string, parent: string | URL): Promise<unknown> {
  let namespace = `remix-node-tsx-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let parentURL = toParentURL(parent)
  let resolvedSpecifier = path.isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier

  process.setSourceMapsEnabled(true)
  register(
    new URL(`./register-hooks.js?namespace=${encodeURIComponent(namespace)}`, import.meta.url),
    {
      data: { namespace },
      parentURL: import.meta.url,
    },
  )

  return import(createLoadModuleSpecifier(resolvedSpecifier, parentURL, namespace))
}

function toParentURL(parent: string | URL): string {
  if (parent instanceof URL) {
    return parent.href
  }

  if (URL.canParse(parent)) {
    return new URL(parent).href
  }

  return pathToFileURL(parent).href
}
