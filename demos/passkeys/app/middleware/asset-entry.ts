import * as path from 'node:path'
import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import type { ScriptEntry } from 'remix/assets'

import { assets } from '../utils/assets.ts'

interface AssetEntry {
  scriptEntry: ScriptEntry
}

const assetEntryKey = createContextKey<AssetEntry>()
const scriptEntryPath = path.resolve(import.meta.dirname, '../actions/public/entry.tsx')

export function loadAssetEntry(): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    context.set(assetEntryKey, { scriptEntry: await assets.getScriptEntry(scriptEntryPath) })
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
