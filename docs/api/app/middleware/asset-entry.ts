import * as path from 'node:path'

import { getContext } from 'remix/middleware/async-context'
import { createContextKey, type Middleware } from 'remix/router'

import type { DocsAssetServer } from '../utils/assets.ts'

interface AssetEntry {
  scriptSrc: string
  scriptPreloads: string[]
  stylesheetHref: string
  stylesheetPreloads: string[]
}

const assetEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')
const defaultStylesheet = path.resolve(import.meta.dirname, '../assets/docs.css')

export function loadAssetEntry(
  assetServer: DocsAssetServer,
  scriptEntry = defaultScriptEntry,
  stylesheet = defaultStylesheet,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads, stylesheetHref, stylesheetPreloads] = await Promise.all([
      assetServer.getHref(scriptEntry),
      assetServer.getPreloads(scriptEntry).catch(() => []),
      assetServer.getHref(stylesheet),
      assetServer.getPreloads(stylesheet).catch(() => []),
    ])

    context.set(assetEntryKey, {
      scriptSrc,
      scriptPreloads,
      stylesheetHref,
      stylesheetPreloads,
    })

    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
