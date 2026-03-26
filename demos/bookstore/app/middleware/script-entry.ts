import * as path from 'node:path'
import { createContextKey } from 'remix/fetch-router'
import type { Middleware } from 'remix/fetch-router'
import { getContext } from 'remix/async-context-middleware'

import { scriptServer } from '../utils/scripts.ts'

interface ScriptEntry {
  src: string
  preloads: string[]
}

const scriptEntryKey = createContextKey<ScriptEntry>()
const defaultEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')

export function loadScriptEntry(entry = defaultEntry): Middleware {
  return async (context, next) => {
    let [src, preloads] = await Promise.all([
      scriptServer.getHref(entry),
      scriptServer.getPreloads(entry).catch(() => []),
    ])

    context.set(scriptEntryKey, {
      src,
      preloads,
    })
    return next()
  }
}

export function getScriptEntry(): ScriptEntry {
  return getContext().get(scriptEntryKey)
}
