import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { AssetServer } from 'remix/assets'

export async function discoverPublicModuleHrefs(
  assetServer: Pick<AssetServer, 'getHref' | 'getPreloads'>,
  rootDirs: string[],
): Promise<string[]> {
  let hrefs = new Set<string>()

  for (let rootDir of rootDirs) {
    for await (let entry of fs.glob('**/public/**/*.{ts,tsx}', { cwd: rootDir })) {
      if (entry.includes('.test.') || path.basename(entry) === 'dev-refresh.ts') {
        continue
      }

      let entryPath = path.join(rootDir, entry)
      hrefs.add(await assetServer.getHref(entryPath))
      let preloads = await assetServer.getPreloads(entryPath).catch(() => [])
      preloads.forEach((preload) => hrefs.add(preload))
    }
  }

  return Array.from(hrefs).sort()
}
