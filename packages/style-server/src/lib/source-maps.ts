import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'

import { normalizeFilePath } from './paths.ts'

export function composeSourceMaps(rewriteSourceMap: string, transformSourceMap: string): string {
  let rewriteConsumer = new SourceMapConsumer(JSON.parse(rewriteSourceMap))
  let transformConsumer = new SourceMapConsumer(JSON.parse(transformSourceMap))
  let generator = new SourceMapGenerator()

  rewriteConsumer.eachMapping((mapping) => {
    if (
      mapping.originalLine == null ||
      mapping.originalColumn == null ||
      mapping.generatedLine == null ||
      mapping.generatedColumn == null
    ) {
      return
    }

    let original = transformConsumer.originalPositionFor({
      line: mapping.originalLine,
      column: mapping.originalColumn,
    })
    if (original.line == null || original.column == null || original.source == null) return

    generator.addMapping({
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn,
      },
      original: {
        line: original.line,
        column: original.column,
      },
      source: original.source,
      name: original.name ?? mapping.name ?? undefined,
    })
  })

  for (let source of transformConsumer.sources) {
    let sourceContent = transformConsumer.sourceContentFor(source, true)
    if (sourceContent !== null) {
      generator.setSourceContent(source, sourceContent)
    }
  }

  return JSON.stringify(generator.toJSON())
}

export function stringifySourceMap(map: unknown): string | null {
  if (!map) return null
  if (typeof map === 'string') return map
  if (map instanceof Uint8Array) return Buffer.from(map).toString('utf8')
  if (map instanceof ArrayBuffer) return Buffer.from(map).toString('utf8')
  if (typeof map === 'object' && map !== null) return JSON.stringify(map)
  return String(map)
}

export function rewriteSourceMapSources(
  sourceMap: string,
  resolvedPath: string,
  stableUrlPathname: string,
  sourceMapSourcePaths: 'absolute' | 'url' = 'url',
): string {
  let json = JSON.parse(sourceMap) as { sources?: string[] }
  json.sources = [
    sourceMapSourcePaths === 'absolute' ? normalizeFilePath(resolvedPath) : stableUrlPathname,
  ]
  return JSON.stringify(json)
}
