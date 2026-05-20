import * as path from 'node:path'
import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'

import { assetServer } from '../utils/assets.ts'

interface AssetEntry {
  scriptSrc: string
  scriptPreloads: string[]
}

const assetEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')

export function loadAssetEntry(
  scriptEntry = defaultScriptEntry,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads] = await Promise.all([
      assetServer.getHref(scriptEntry),
      assetServer.getPreloads(scriptEntry).catch(() => []),
    ])

    context.set(assetEntryKey, { scriptSrc, scriptPreloads })
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
