import * as path from 'node:path'

import { getContext } from 'remix/middleware/async-context'
import { createContextKey, type Middleware } from 'remix/router'
import type { ScriptEntry } from 'remix/assets'

import type { DocsAssetServer } from '../assets.ts'

interface AssetEntry {
  scriptEntry: ScriptEntry
  stylesheetHref: string
  stylesheetPreloads: string[]
}

const assetEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../actions/public/entry.tsx')
const defaultStylesheet = path.resolve(import.meta.dirname, '../actions/public/docs.css')

export function loadAssetEntry(
  assetServer: DocsAssetServer,
  scriptEntry = defaultScriptEntry,
  stylesheet = defaultStylesheet,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
  let assetEntryPromise: Promise<AssetEntry> | undefined

  return async (context, next) => {
    assetEntryPromise ??= Promise.all([
      assetServer.getScriptEntry(scriptEntry),
      assetServer.getHref(stylesheet),
      assetServer.getPreloads(stylesheet),
    ]).then(([resolvedScriptEntry, stylesheetHref, stylesheetPreloads]) => ({
      scriptEntry: resolvedScriptEntry,
      stylesheetHref,
      stylesheetPreloads,
    }))

    context.set(assetEntryKey, await assetEntryPromise)
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetEntryKey)
}
