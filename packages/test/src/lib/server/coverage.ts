import * as path from 'node:path'
import V8ToIstanbul from 'v8-to-istanbul'
import istanbulCoverage from 'istanbul-lib-coverage'
import { createContext } from 'istanbul-lib-report'
import { create as createReport } from 'istanbul-reports'

export interface CoverageEntry {
  url: string
  source?: string
  functions: Array<{
    functionName: string
    isBlockCoverage: boolean
    ranges: Array<{ startOffset: number; endOffset: number; count: number }>
  }>
}

export async function generateCoverageReport(
  entries: CoverageEntry[],
  outputDir = '.coverage',
): Promise<void> {
  let coverageMap = istanbulCoverage.createCoverageMap({})

  for (let entry of entries) {
    // Only include user test files, not framework/vendor scripts
    if (!entry.url.includes('/scripts/@test/') || !entry.source) continue

    try {
      let converter = V8ToIstanbul(entry.url, 0, { source: entry.source })
      await converter.load()
      converter.applyCoverage(entry.functions)
      coverageMap.merge(converter.toIstanbul())
    } catch {
      // Skip entries that can't be converted (e.g. missing source maps)
    }
  }

  let dir = path.resolve(process.cwd(), outputDir)
  let context = createContext({ coverageMap, dir })
  createReport('text').execute(context)

  console.log(`\nHTML coverage report written to ${outputDir}/`)
}
