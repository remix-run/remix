import { createContextKey } from 'remix/fetch-router'
import type { Middleware } from 'remix/fetch-router'
import { getContext } from 'remix/async-context-middleware'

import { routes } from '../routes.ts'
import { scriptServer } from '../utils/scripts.ts'

interface ScriptEntry {
  src: string
  preloads: string[]
}

let scriptEntryKey = createContextKey<ScriptEntry>()

export function loadScriptEntry(entry = 'app/assets/entry.tsx'): Middleware {
  return async (context, next) => {
    let src = routes.scripts.href({ path: entry })
    context.set(scriptEntryKey, {
      src,
      preloads: await scriptServer.preloads(src).catch(() => []),
    })
    return next()
  }
}

export function getScriptEntry(): ScriptEntry {
  return getContext().get(scriptEntryKey)
}
