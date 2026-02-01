import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { genericCompressibleMimeTypeRegex } from '../src/lib/is-compressible-mime-type.ts'

interface MimeDbEntry {
  source?: string
  compressible?: boolean
  extensions?: string[]
}

type MimeDb = Record<string, MimeDbEntry>

// Generates the content for compressible-mime-types.ts from mime-db
export function generateCompressibleMimeTypesContent(): string {
  let mimeDbPath = fileURLToPath(import.meta.resolve('mime-db/db.json'))
  let mimeDb: MimeDb = JSON.parse(readFileSync(mimeDbPath, 'utf-8'))

  let compressibleTypes: string[] = []

  for (let [mimeType, entry] of Object.entries(mimeDb)) {
    if (
      entry.compressible &&
      // Skip types already handled by generic compressibility logic
      !genericCompressibleMimeTypeRegex.test(mimeType)
    ) {
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

// Generates the content for mime-types.ts from mime-db
export function generateMimeTypesContent(): string {
  let mimeDbPath = fileURLToPath(import.meta.resolve('mime-db/db.json'))
  let mimeDb: MimeDb = JSON.parse(readFileSync(mimeDbPath, 'utf-8'))

  let isExperimentalOrVendor = (mimeType: string) => /[/](x-|vnd\.)/.test(mimeType)

  let extensionMap: Record<string, string> = {}

  for (let [mimeType, entry] of Object.entries(mimeDb)) {
    if (!entry.extensions) continue

    for (let ext of entry.extensions) {
      // Prefer standard types, then compressible types, then source=iana, then first seen
      if (!extensionMap[ext]) {
        extensionMap[ext] = mimeType
      } else {
        let existingMimeType = extensionMap[ext]
        let existingEntry = mimeDb[existingMimeType]
        let existingIsExperimental = isExperimentalOrVendor(existingMimeType)
        let newIsExperimental = isExperimentalOrVendor(mimeType)

        // Prefer standard types over experimental/vendor types
        if (existingIsExperimental && !newIsExperimental) {
          extensionMap[ext] = mimeType
        }
        // If both are standard or both are experimental, apply secondary rules
        else if (existingIsExperimental === newIsExperimental) {
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
  }

  // Sort by extension for consistent output
  let sortedExtensions = Object.keys(extensionMap).sort()
  let entries = sortedExtensions.map((ext) => `  ${formatKey(ext)}: '${extensionMap[ext]}',`)

  return `// DO NOT EDIT. THIS IS GENERATED CODE.
// Run \`pnpm codegen\` to update.

export let mimeTypes: Record<string, string> = {
${entries.join('\n')}
}
`
}

// Formats a key for use as a property name in a JavaScript object
function formatKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `'${key}'`
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
  let extensionCount = (mimeTypesContent.match(/  '/g) || []).length
  writeFileSync(mimeTypesOutputPath, mimeTypesContent)
  console.log(`Generated ${extensionCount} extension mappings to ${mimeTypesOutputPath}`)
}
