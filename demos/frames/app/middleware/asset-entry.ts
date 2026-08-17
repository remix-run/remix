import * as path from 'node:path'
import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import type { ScriptEntry } from 'remix/assets'

import { assetServer } from '../utils/assets.ts'

interface AssetEntry {
  scriptEntry: ScriptEntry
}

const assetEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../actions/public/entry.tsx')

export function loadAssetEntry(
  scriptEntry = defaultScriptEntry,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let resolvedScriptEntry = await assetServer.getScriptEntry(scriptEntry)

    context.set(assetEntryKey, { scriptEntry: resolvedScriptEntry })
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
