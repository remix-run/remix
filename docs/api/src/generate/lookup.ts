import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { WEBSITE_DOCS_PATH, type DocumentedAPI } from './documented-api.ts'
import { info, warn } from './utils.ts'

export async function writeLookupFile(apis: DocumentedAPI[], docsDir: string) {
  let lookup: Record<string, string> = {}

  for (let api of apis) {
    let urlPath = `${WEBSITE_DOCS_PATH}/${api.path}`
    if (api.name in lookup) {
      warn(
        `Duplicate API name \`${api.name}\` in lookup file; ` +
          `overwriting \`${lookup[api.name]}\` with \`${urlPath}\``,
      )
    }
    lookup[api.name] = urlPath
  }

  let sorted = Object.fromEntries(Object.entries(lookup).sort(([a], [b]) => a.localeCompare(b)))

  let lookupPath = path.join(docsDir, 'api.json')
  info(`Writing API lookup file: ${lookupPath}`)
  await fs.writeFile(lookupPath, JSON.stringify(sorted) + '\n')
}
