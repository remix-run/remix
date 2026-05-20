export { toUnicode as decodeHostname } from './punycode.ts'

const ENCODED_SLASH = /%2f/gi
const SLASH_PLACEHOLDER = '\uFDD0'

export function decodePathnameSegments(source: string): Array<string> {
  return source.split('/').map(decodePathnameSegment)
}

export function restorePathnameParam(value: string): string {
  return value.replaceAll(SLASH_PLACEHOLDER, '/')
}

function decodePathnameSegment(source: string): string {
  if (!source.includes('%')) return source

  try {
    return decodeURIComponent(source.replace(ENCODED_SLASH, SLASH_PLACEHOLDER))
  } catch {
    return source
  }
}
