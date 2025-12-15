import { renderBreadcrumb } from './breadcrumb.ts'
import type { PackageFile } from './utils/npm.ts'
import { html, render, formatBytes } from './utils/render.ts'

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

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'])

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
}

function getExtension(filename: string): string {
  let lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return filename.toUpperCase()
  return filename.slice(lastDot).toLowerCase()
}

function isTextFile(filename: string): boolean {
  let ext = getExtension(filename)
  return TEXT_EXTENSIONS.has(ext)
}

function isImageFile(filename: string): boolean {
  let ext = getExtension(filename)
  return IMAGE_EXTENSIONS.has(ext)
}

function isLikelyText(data: Uint8Array): boolean {
  let sampleSize = Math.min(data.length, 8192)
  for (let i = 0; i < sampleSize; i++) {
    let byte = data[i]
    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return false
    }
  }
  return true
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function renderFileContent(
  packageName: string,
  version: string,
  filePath: string,
  file: PackageFile,
  data: Uint8Array,
): Response {
  let title = `${packageName}@${version}/${filePath}`
  let ext = getExtension(file.name)
  let breadcrumb = renderBreadcrumb(packageName, version, filePath)

  let content
  if (isImageFile(file.name)) {
    let mimeType = IMAGE_MIME_TYPES[ext] || 'image/png'
    let base64 = bytesToBase64(data)
    content = html`
      <div class="file-content">
        <img src="data:${mimeType};base64,${base64}" alt="${file.name}" />
      </div>
    `
  } else if (isTextFile(file.name) || isLikelyText(data)) {
    let text = new TextDecoder().decode(data)
    content = html`
      <div class="file-content">
        <pre>${text}</pre>
      </div>
    `
  } else {
    content = html`
      <div class="info">
        <p>This file cannot be displayed. It may be a binary file.</p>
        <p>File size: ${formatBytes(file.size)}</p>
      </div>
    `
  }

  return render(
    title,
    html`
      <h1>${file.name}</h1>
      ${breadcrumb}
      <p class="package-info">Size: ${formatBytes(file.size)}</p>
      ${content}
    `,
  )
}
