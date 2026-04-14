import * as path from 'node:path'
import { createContextKey } from 'remix/fetch-router'
import type { Middleware } from 'remix/fetch-router'
import { getContext } from 'remix/async-context-middleware'

import { assetServer } from '../utils/assets.ts'

interface AssetEntry {
  src: string
  preloads: string[]
}

const assetsEntryKey = createContextKey<AssetEntry>()
const defaultEntry = path.resolve(import.meta.dirname, '../assets/entry.tsx')

export function loadAssetEntry(entry = defaultEntry): Middleware {
  return async (context, next) => {
    let [src, preloads] = await Promise.all([
      assetServer.getHref(entry),
      assetServer.getPreloads(entry).catch(() => []),
    ])

    context.set(assetsEntryKey, {
      src,
      preloads,
    })
    return next()
  }
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(assetsEntryKey)
}
