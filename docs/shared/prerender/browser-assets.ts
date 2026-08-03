import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { AssetServer } from 'remix/assets'

export interface BrowserAssetSource {
  rootDir: string
  patterns: string[]
}

export async function discoverBrowserAssetHrefs(
  assetServer: Pick<AssetServer, 'getHref' | 'getPreloads'>,
  sources: BrowserAssetSource[],
): Promise<string[]> {
  let hrefs = new Set<string>()

  for (let source of sources) {
    for (let pattern of source.patterns) {
      for await (let entry of fs.glob(pattern, { cwd: source.rootDir })) {
        if (entry.includes('.test.') || path.basename(entry).startsWith('dev-refresh.browser.')) {
          continue
        }

        let entryPath = path.join(source.rootDir, entry)
        hrefs.add(await assetServer.getHref(entryPath))
        let preloads = await assetServer.getPreloads(entryPath).catch(() => [])
        preloads.forEach((preload) => hrefs.add(preload))
      }
    }
  }

  return Array.from(hrefs).sort()
}
