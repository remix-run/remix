import * as path from 'node:path'

const OWNER_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const
const ACTIONS_DIRECTORY = path.join('app', 'actions')

export type OwnerFileExtension = (typeof OWNER_FILE_EXTENSIONS)[number]

export function getControllerOwnerCandidates(segments: string[]): string[] {
  return OWNER_FILE_EXTENSIONS.map((extension) =>
    normalizeRelativePath(path.join(ACTIONS_DIRECTORY, ...segments, `controller${extension}`)),
  )
}

export function getRouteSubtreePath(segments: string[]): string {
  return normalizeRelativePath(path.join(ACTIONS_DIRECTORY, ...segments))
}

export function getPreferredOwnerDisplayPath(candidates: string[]): string {
  let tsxCandidate = candidates.find((candidate) => candidate.endsWith('.tsx'))
  return tsxCandidate ?? candidates[0] ?? ''
}

export function getOwnerCandidateForExtension(
  candidates: string[],
  extension: OwnerFileExtension,
): string | null {
  return candidates.find((candidate) => candidate.endsWith(extension)) ?? null
}

export function getOwnerFileExtension(filePath: string): OwnerFileExtension | null {
  return OWNER_FILE_EXTENSIONS.find((extension) => filePath.endsWith(extension)) ?? null
}

export function toDiskSegment(segment: string): string {
  let diskSegment = segment
    .replace(/[\\/]+/g, '-')
    .replace(/\.+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return diskSegment.length === 0 ? 'route' : diskSegment
}

export function isControllerEntryFileName(fileName: string): boolean {
  return OWNER_FILE_EXTENSIONS.some((extension) => fileName === `controller${extension}`)
}

export function getOwnerModuleBaseName(fileName: string): string | null {
  let extension = OWNER_FILE_EXTENSIONS.find((ownerExtension) => fileName.endsWith(ownerExtension))

  if (extension == null) {
    return null
  }

  return fileName.slice(0, -extension.length)
}

export function isActionFileName(fileName: string): boolean {
  let baseName = getOwnerModuleBaseName(fileName)

  return (
    baseName != null &&
    baseName !== 'controller' &&
    !baseName.endsWith('.test') &&
    !baseName.endsWith('.spec')
  )
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}
