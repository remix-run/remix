import { detectMimeType } from 'remix/mime'

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
  '.jsx',
  '.json',
  '.md',
  '.markdown',
  '.txt',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.htm',
  '.xml',
  '.svg',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.ps1',
  '.bat',
  '.cmd',
  '.py',
  '.rb',
  '.php',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.go',
  '.rs',
  '.swift',
  '.kt',
  '.scala',
  '.clj',
  '.ex',
  '.exs',
  '.erl',
  '.hrl',
  '.lua',
  '.r',
  '.sql',
  '.graphql',
  '.gql',
  '.vue',
  '.svelte',
  '.astro',
  '.prisma',
  '.env',
  '.gitignore',
  '.npmignore',
  '.eslintrc',
  '.prettierrc',
  '.editorconfig',
  'LICENSE',
  'README',
  'CHANGELOG',
  'Makefile',
  'Dockerfile',
])

const IMAGE_MIME_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.bmp', 'image/bmp'],
])

export function detectFileMimeType(filename: string): string {
  return detectMimeType(filename) ?? 'application/octet-stream'
}

export function getImageMimeType(filename: string): string | undefined {
  return IMAGE_MIME_TYPES.get(getExtension(filename))
}

export function isTextContent(filename: string, data: Uint8Array): boolean {
  return isTextFile(filename) || isLikelyText(data)
}

export function getExtension(filename: string): string {
  let lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return filename.toUpperCase()
  return filename.slice(lastDot).toLowerCase()
}

export function isTextFile(filename: string): boolean {
  return TEXT_EXTENSIONS.has(getExtension(filename))
}

export function isLikelyText(data: Uint8Array): boolean {
  let sampleSize = Math.min(data.length, 8192)
  for (let i = 0; i < sampleSize; i++) {
    let byte = data[i]
    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return false
    }
  }
  return true
}
