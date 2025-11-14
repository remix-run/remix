import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Generates the content for compressible-media-types.ts from mime-db
 * @returns {string} The generated TypeScript file content
 */
export function generateCompressibleMediaTypesContent() {
  let mimeDbPath = fileURLToPath(import.meta.resolve('mime-db/db.json'))
  let mimeDb = JSON.parse(readFileSync(mimeDbPath, 'utf-8'))

  // Ignore MIME types that are experimental or vendor-specific
  let ignoreMimeRegex = /[/](x-|vnd\.)/

  let compressibleTypes = []

  for (let [mimeType, entry] of Object.entries(mimeDb)) {
    if (entry.compressible && !ignoreMimeRegex.test(mimeType)) {
      compressibleTypes.push(mimeType)
    }
  }

  compressibleTypes.sort()

  return `// DO NOT EDIT. THIS IS GENERATED CODE.
// Run \`pnpm --filter @remix-run/fetch-router run generate:compressible\` to update.

export let compressibleMediaTypes = new Set([
${compressibleTypes.map((type) => `  '${type}',`).join('\n')}
])
`
}

// Only run when executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  let __dirname = dirname(fileURLToPath(import.meta.url))
  let outputPath = join(__dirname, '../src/lib/compressible-media-types.ts')

  let content = generateCompressibleMediaTypesContent()
  let compressibleCount = (content.match(/  '/g) || []).length

  writeFileSync(outputPath, content)

  console.log(`Generated ${compressibleCount} compressible media types to ${outputPath}`)
}
