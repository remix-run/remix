import * as path from 'node:path'
import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import type { ScriptEntry } from 'remix/assets'

import { assets } from '../utils/assets.ts'

const assetEntryKey = createContextKey<ScriptEntry>()
const scriptEntryPath = path.resolve(import.meta.dirname, '../actions/public/entry.tsx')

export function loadAssetEntry(): Middleware<{ key: typeof assetEntryKey; value: ScriptEntry }> {
  return async (context, next) => {
    context.set(assetEntryKey, await assets.getScriptEntry(scriptEntryPath))
    return next()
  }
}

export function getScriptEntry(): ScriptEntry {
  return getContext().get(assetEntryKey)
}
