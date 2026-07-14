import * as path from 'node:path'
import { createContextKey, type Middleware } from 'remix/router'

import { assetServer } from '../utils/assets.ts'

export interface AssetEntryValue {
  scriptSrc: string
  scriptPreloads: string[]
}

export const AssetEntry = createContextKey<AssetEntryValue>()
const scriptEntry = path.resolve(import.meta.dirname, '../assets/entry.ts')

export function loadAssetEntry(): Middleware<{ key: typeof AssetEntry; value: AssetEntryValue }> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads] = await Promise.all([
      assetServer.getHref(scriptEntry),
      assetServer.getPreloads(scriptEntry).catch(() => []),
    ])

    context.set(AssetEntry, { scriptSrc, scriptPreloads })
    return next()
  }
}
