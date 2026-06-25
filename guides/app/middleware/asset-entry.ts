import * as path from 'node:path'

import { getContext } from 'remix/middleware/async-context'
import { createContextKey, type Middleware } from 'remix/router'

import { assetServer } from '../utils/assets.ts'

interface AssetEntry {
  scriptSrc: string
  scriptPreloads: string[]
  stylesheetHref: string
  devRefreshScriptSrc?: string
}

const assetEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.ts')
const defaultDevRefreshScriptEntry = path.resolve(
  import.meta.dirname,
  '../../public/dev-refresh.ts',
)
const defaultStylesheet = path.resolve(import.meta.dirname, '../../public/styles/docs.css')

export function loadAssetEntry(
  scriptEntry = defaultScriptEntry,
  devRefreshScriptEntry = defaultDevRefreshScriptEntry,
  stylesheet = defaultStylesheet,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads, stylesheetHref, devRefreshScriptSrc] = await Promise.all([
      assetServer.getHref(scriptEntry),
      assetServer.getPreloads(scriptEntry).catch(() => []),
      assetServer.getHref(stylesheet),
      process.env.NODE_ENV === 'production'
        ? Promise.resolve(undefined)
        : assetServer.getHref(devRefreshScriptEntry),
    ])

    context.set(assetEntryKey, {
      scriptSrc,
      scriptPreloads,
      stylesheetHref,
      ...(devRefreshScriptSrc ? { devRefreshScriptSrc } : {}),
    })

    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
