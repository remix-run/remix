import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { AssetServer } from 'remix/assets'

export async function discoverPublicModuleHrefs(
  assetServer: Pick<AssetServer, 'getHref' | 'getImportMap' | 'getPreloads'>,
  rootDirs: string[],
): Promise<string[]> {
  let hrefs = new Set<string>()

  for (let rootDir of rootDirs) {
    for await (let entry of fs.glob('**/public/**/*.{ts,tsx}', { cwd: rootDir })) {
      if (
        entry.includes('.test.') ||
        entry.includes('.dev.') ||
        path.basename(entry) === 'dev-refresh.ts'
      ) {
        continue
      }

      let entryPath = path.join(rootDir, entry)
      hrefs.add(await assetServer.getHref(entryPath))
      let preloads = await assetServer.getPreloads(entryPath).catch(() => [])
      preloads.forEach((preload) => hrefs.add(preload))
      let importMap = await assetServer.getImportMap(entryPath)
      Object.values(importMap.imports).forEach(addLocalHref)
      Object.values(importMap.scopes ?? {}).forEach((scope) => {
        Object.values(scope).forEach(addLocalHref)
      })
    }
  }

  return Array.from(hrefs).sort()

  function addLocalHref(href: string) {
    if (href.startsWith('/')) hrefs.add(href)
  }
}
