import * as path from 'node:path'
import { createContextKey } from 'remix/fetch-router'
import type { Middleware } from 'remix/fetch-router'
import { getContext } from 'remix/async-context-middleware'

import { assetServer } from '../utils/assets.ts'

interface AssetEntry {
  scriptSrc: string
  scriptPreloads: string[]
  stylesheetHref: string
}

const assetsEntryKey = createContextKey<AssetEntry>()
const defaultScriptEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')
const defaultStylesheetEntry = path.resolve(import.meta.dirname, '../assets/app.css')

export function loadAssetEntry(
  scriptEntry = defaultScriptEntry,
  stylesheetEntry = defaultStylesheetEntry,
): Middleware {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads, stylesheetHref] = await Promise.all([
      assetServer.getHref(scriptEntry),
      assetServer.getPreloads(scriptEntry).catch(() => []),
      assetServer.getHref(stylesheetEntry),
    ])

    context.set(assetsEntryKey, {
      scriptSrc,
      scriptPreloads,
      stylesheetHref,
    })
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetsEntryKey)
}
