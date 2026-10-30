import { SetCookie } from 'remix/headers'

import { db } from '../app/data/db.ts'
import { loadCatalogMigrations, seedCatalog } from '../app/data/setup.ts'
import { createAppRouter } from '../app/router.ts'

export const origin = 'https://supply.example'

export async function createTestRouter() {
  await db.reset({ migrations: await loadCatalogMigrations(), seed: seedCatalog })
  return createAppRouter()
}

/** Headers the client runtime sends when a link targets the content frame. */
export const contentFrameHeaders = {
  Accept: 'text/html',
  'X-Remix-Frame': 'true',
  'X-Remix-Target': 'content',
}

/** Returns the `name=value` pair for a cookie set by `response`, ready for a `Cookie` header. */
export function getCookiePair(response: Response, name: string): string {
  for (let header of response.headers.getSetCookie()) {
    let cookie = new SetCookie(header)
    if (cookie.name === name && cookie.value != null) return `${cookie.name}=${cookie.value}`
  }

  throw new Error(`Expected response to set the "${name}" cookie`)
}
