import { createContextKey } from 'remix/fetch-router'
import type { Middleware } from 'remix/fetch-router'
import { getContext } from 'remix/async-context-middleware'

import { routes } from '../routes.ts'
import { scriptHandler } from '../utils/scripts.ts'

interface ScriptEntry {
  src: string
  preloads: string[]
}

let scriptEntryKey = createContextKey<ScriptEntry>()

export function loadScriptEntry(entry = 'app/entry.tsx'): Middleware {
  return async (context, next) => {
    context.set(scriptEntryKey, {
      src: routes.scripts.href({ path: entry }),
      preloads: await scriptHandler.preloads(entry),
    })
    return next()
  }
}

export function getScriptEntry(): ScriptEntry {
  return getContext().get(scriptEntryKey)
}
