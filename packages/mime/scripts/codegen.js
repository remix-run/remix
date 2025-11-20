import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Generates the content for compressible-mime-types.ts from mime-db
 * @returns {string} The generated TypeScript file content
 */
export function generateCompressibleMimeTypesContent() {
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
// Run \`pnpm codegen\` to update.

export let compressibleMimeTypes = new Set([
${compressibleTypes.map((type) => `  '${type}',`).join('\n')}
])
`
}

/**
 * Generates the content for mime-types.ts from mime-db
 * @returns {string} The generated TypeScript file content
 */
export function generateMimeTypesContent() {
  let mimeDbPath = fileURLToPath(import.meta.resolve('mime-db/db.json'))
  let mimeDb = JSON.parse(readFileSync(mimeDbPath, 'utf-8'))

  // Ignore MIME types that are experimental or vendor-specific
  let ignoreMimeRegex = /[/](x-|vnd\.)/

  let extensionMap = {}

  for (let [mimeType, entry] of Object.entries(mimeDb)) {
    if (ignoreMimeRegex.test(mimeType)) continue
    if (!entry.extensions) continue

    for (let ext of entry.extensions) {
      // Prefer compressible types, then source=iana, then first seen
      if (!extensionMap[ext]) {
        extensionMap[ext] = mimeType
      } else {
        let existingEntry = mimeDb[extensionMap[ext]]
        // Prefer compressible types
        if (entry.compressible && !existingEntry.compressible) {
          extensionMap[ext] = mimeType
        }
        // If both compressible or both not, prefer source=iana
        else if (entry.compressible === existingEntry.compressible && entry.source === 'iana') {
          extensionMap[ext] = mimeType
        }
      }
    }
  }

  // Sort by extension for consistent output
  let sortedExtensions = Object.keys(extensionMap).sort()
  let entries = sortedExtensions.map(
    (ext) => `  ${JSON.stringify(ext)}: ${JSON.stringify(extensionMap[ext])},`,
  )

  return `// DO NOT EDIT. THIS IS GENERATED CODE.
// Run \`pnpm codegen\` to update.

export let mimeTypes: Record<string, string> = {
${entries.join('\n')}
}
`
}

// Only run when executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  let __dirname = dirname(fileURLToPath(import.meta.url))

  // Generate compressible-mime-types.ts
  let compressibleOutputPath = join(__dirname, '../src/generated/compressible-mime-types.ts')
  let compressibleContent = generateCompressibleMimeTypesContent()
  let compressibleCount = (compressibleContent.match(/  '/g) || []).length
  writeFileSync(compressibleOutputPath, compressibleContent)
  console.log(`Generated ${compressibleCount} compressible MIME types to ${compressibleOutputPath}`)

  // Generate mime-types.ts
  let mimeTypesOutputPath = join(__dirname, '../src/generated/mime-types.ts')
  let mimeTypesContent = generateMimeTypesContent()
  let extensionCount = (mimeTypesContent.match(/  "/g) || []).length
  writeFileSync(mimeTypesOutputPath, mimeTypesContent)
  console.log(`Generated ${extensionCount} extension mappings to ${mimeTypesOutputPath}`)
}
