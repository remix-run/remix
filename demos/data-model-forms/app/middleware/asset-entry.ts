import * as path from 'node:path'
import { createContextKey, type Middleware } from 'remix/router'
import type { ScriptEntry } from 'remix/assets'

import { assetServer } from '../assets.ts'

export interface AssetEntryValue {
  scriptEntry: ScriptEntry
}

export const AssetEntry = createContextKey<AssetEntryValue>()
const scriptEntry = path.resolve(import.meta.dirname, '../actions/public/entry.ts')

export function loadAssetEntry(): Middleware<{ key: typeof AssetEntry; value: AssetEntryValue }> {
  return async (context, next) => {
    context.set(AssetEntry, { scriptEntry: await assetServer.getScriptEntry(scriptEntry) })
    return next()
  }
}
