import * as path from 'node:path'

import { getContext } from 'remix/middleware/async-context'
import { createContextKey, type Middleware } from 'remix/router'

import { assetServer } from '../utils/assets.ts'

interface AssetEntry {
  scriptSrc: string
  scriptPreloads: string[]
  devRefreshScriptSrc?: string
}

const assetEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.ts')
const defaultDevRefreshScriptEntry = path.resolve(import.meta.dirname, '../assets/dev-refresh.ts')

export function loadAssetEntry(
  scriptEntry = defaultScriptEntry,
  devRefreshScriptEntry = defaultDevRefreshScriptEntry,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads, devRefreshScriptSrc] = await Promise.all([
      assetServer.getHref(scriptEntry),
      assetServer.getPreloads(scriptEntry).catch(() => []),
      process.env.NODE_ENV === 'production'
        ? Promise.resolve(undefined)
        : assetServer.getHref(devRefreshScriptEntry),
    ])

    context.set(assetEntryKey, {
      scriptSrc,
      scriptPreloads,
      ...(devRefreshScriptSrc ? { devRefreshScriptSrc } : {}),
    })

    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
