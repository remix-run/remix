import * as path from 'node:path'
import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import type { ScriptEntry } from 'remix/assets'

import { assetServer } from '../utils/assets.ts'

interface AssetEntry {
  scriptEntry: ScriptEntry
  stylesheetHref: string
}

const assetsEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../actions/public/entry.tsx')
const defaultStylesheetEntry = path.resolve(import.meta.dirname, '../actions/public/app.css')

export function loadAssetEntry(
  scriptEntry = defaultScriptEntry,
  stylesheetEntry = defaultStylesheetEntry,
): Middleware<{ key: typeof assetsEntryKey; value: AssetEntry }> {
  return async (context, next) => {
    let [resolvedScriptEntry, stylesheetHref] = await Promise.all([
      assetServer.getScriptEntry(scriptEntry),
      assetServer.getHref(stylesheetEntry),
    ])

    context.set(assetsEntryKey, {
      scriptEntry: resolvedScriptEntry,
      stylesheetHref,
    })
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetsEntryKey)
}
