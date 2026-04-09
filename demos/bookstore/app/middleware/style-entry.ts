import * as path from 'node:path'
import { getContext } from 'remix/async-context-middleware'
import { createContextKey } from 'remix/fetch-router'
import type { Middleware } from 'remix/fetch-router'

import { styleServer } from '../utils/style-server.ts'

interface StyleEntry {
  href: string
}

const styleEntryKey = createContextKey<StyleEntry>()
const appStyleEntryPath = path.resolve(import.meta.dirname, '../styles/app.css')

export function loadStyleEntry(entry = appStyleEntryPath): Middleware {
  return async (context, next) => {
    let href = await styleServer.getHref(entry)

    context.set(styleEntryKey, {
      href,
    })

    return next()
  }
}

export function getStyleEntry(): StyleEntry {
  return getContext().get(styleEntryKey)
}
