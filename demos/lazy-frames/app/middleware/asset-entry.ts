import * as path from 'node:path'
import { getContext } from 'remix/middleware/async-context'
import { createContextKey, type Middleware } from 'remix/router'

import { assets } from '../utils/assets.ts'

interface AssetEntry {
  scriptSrc: string
  scriptPreloads: string[]
}

const assetEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../actions/public/entry.ts')

export function loadAssetEntry(
  scriptEntry = defaultScriptEntry,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads] = await Promise.all([
      assets.getHref(scriptEntry),
      assets.getPreloads(scriptEntry).catch((error) => {
        console.error(error)
        return []
      }),
    ])

    context.set(assetEntryKey, { scriptSrc, scriptPreloads })
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
