import { mimeTypes } from '../generated/mime-types.ts'
import { customMimeTypeByExtension } from './define-mime-type.ts'

/**
 * Detects the MIME type for a given file extension or filename.
 *
 * Custom MIME types registered via {@link import('./define-mime-type.ts').defineMimeType}
 * take precedence over built-in types.
 *
 * @param extension The file extension (e.g. "txt", ".txt") or filename (e.g. "file.txt")
 * @returns The MIME type string, or undefined if not found
 *
 * @example
 * detectMimeType('txt')           // 'text/plain'
 * detectMimeType('.txt')          // 'text/plain'
 * detectMimeType('file.txt')      // 'text/plain'
 * detectMimeType('unknown')       // undefined
 */
export function detectMimeType(extension: string): string | undefined {
  let ext = extension.trim().toLowerCase()

  // For custom types, support multi-part extensions (e.g. "be.pit") by
  // checking dot-separated suffixes from longest to shortest.
  if (customMimeTypeByExtension != null) {
    let slashIndex = Math.max(ext.lastIndexOf('/'), ext.lastIndexOf('\\'))
    let baseName = slashIndex >= 0 ? ext.slice(slashIndex + 1) : ext
    baseName = baseName.replace(/^\.+/, '')

    if (baseName.length > 0) {
      let customMimeType = customMimeTypeByExtension.get(baseName)
      if (customMimeType !== undefined) {
        return customMimeType
      }

      let dotIndex = baseName.indexOf('.')
      while (dotIndex !== -1) {
        customMimeType = customMimeTypeByExtension.get(baseName.slice(dotIndex + 1))
        if (customMimeType !== undefined) {
          return customMimeType
        }

        dotIndex = baseName.indexOf('.', dotIndex + 1)
      }
    }
  }

  let idx = ext.lastIndexOf('.')
  // If no dot found (~idx === -1, so !~idx === true), use ext as-is.
  // Otherwise, skip past the dot (++idx) and extract the extension.
  // Credit to mrmime for this technique.
  ext = !~idx ? ext : ext.substring(++idx)
  return customMimeTypeByExtension?.get(ext) ?? mimeTypes[ext]
}
