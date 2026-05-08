import { html } from 'remix/html-template'

import type { PackageFile } from '../utils/npm.ts'
import { formatBytes } from '../utils/format-bytes.ts'
import { detectFileMimeType, getImageMimeType, isTextContent } from '../utils/mime-type.ts'
import { icons } from '../ui/icons.ts'
import { render } from './render.ts'

export function renderDirectoryListing(
  packageName: string,
  version: string,
  dirPath: string,
  files: PackageFile[],
): Response {
  let title = dirPath ? `${packageName}@${version}/${dirPath}` : `${packageName}@${version}`
  let breadcrumb = renderBreadcrumb(packageName, version, dirPath)

  let parentRow = dirPath
    ? html`
        <tr>
          <td class="icon">
            <a href="/${packageName}@${version}${getParentPath(dirPath)}">${icons.directory}</a>
          </td>
          <td class="name"><a href="/${packageName}@${version}${getParentPath(dirPath)}">..</a></td>
          <td class="size"><a href="/${packageName}@${version}${getParentPath(dirPath)}">-</a></td>
          <td class="type">
            <a href="/${packageName}@${version}${getParentPath(dirPath)}">directory</a>
          </td>
        </tr>
      `
    : ''

  let fileRows = files.map((file) => {
    let href = `/${packageName}@${version}/${file.path}`
    let icon = file.type === 'directory' ? icons.directory : icons.file
    let displayName = file.type === 'directory' ? file.name + '/' : file.name
    let mimeType = file.type === 'directory' ? 'directory' : detectFileMimeType(file.name)

    return html`
      <tr>
        <td class="icon"><a href="${href}">${icon}</a></td>
        <td class="name"><a href="${href}">${displayName}</a></td>
        <td class="size"><a href="${href}">${formatBytes(file.size)}</a></td>
        <td class="type"><a href="${href}">${mimeType}</a></td>
      </tr>
    `
  })

  return render(
    title,
    html`
      <h1>${packageName}</h1>
      ${breadcrumb}
      <p class="package-info">Version: ${version}</p>
      <div class="file-browser">
        <table>
          <thead>
            <tr>
              <th class="icon"></th>
              <th>Name</th>
              <th class="size">Size</th>
              <th class="type">Type</th>
            </tr>
          </thead>
          <tbody>
            ${parentRow} ${fileRows}
          </tbody>
        </table>
      </div>
    `,
  )
}

export function renderFileContent(
  packageName: string,
  version: string,
  filePath: string,
  file: PackageFile,
  data: Uint8Array,
): Response {
  let title = `${packageName}@${version}/${filePath}`
  let breadcrumb = renderBreadcrumb(packageName, version, filePath)
  let imageMimeType = getImageMimeType(file.name)

  let content
  if (imageMimeType) {
    let base64 = bytesToBase64(data)
    content = html`
      <div class="file-content">
        <img src="data:${imageMimeType};base64,${base64}" alt="${file.name}" />
      </div>
    `
  } else if (isTextContent(file.name, data)) {
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

export function renderError(title: string, message: string): Response {
  return render(
    title,
    html`
      <h1>${title}</h1>
      <div class="error">
        <p>${message}</p>
      </div>
      <p style="margin-top: 1rem;">
        <a href="/">Back to home</a>
      </p>
    `,
    { status: 404 },
  )
}

function renderBreadcrumb(packageName: string, version: string, dirPath: string) {
  let parts: Array<{ name: string; href: string }> = [
    { name: 'Home', href: '/' },
    { name: `${packageName}@${version}`, href: `/${packageName}@${version}` },
  ]

  if (dirPath) {
    let pathParts = dirPath.split('/')
    let currentPath = ''
    for (let part of pathParts) {
      currentPath += (currentPath ? '/' : '') + part
      parts.push({
        name: part,
        href: `/${packageName}@${version}/${currentPath}`,
      })
    }
  }

  let links = parts.map((part, i) => {
    if (i === parts.length - 1) {
      return html`<span>${part.name}</span>`
    }
    return html`<a href="${part.href}">${part.name}</a>`
  })

  return html`<nav class="breadcrumb">
    ${links.map((link, i) => (i === 0 ? link : html` / ${link}`))}
  </nav>`
}

function getParentPath(dirPath: string): string {
  let parts = dirPath.split('/')
  parts.pop()
  return parts.length > 0 ? '/' + parts.join('/') : ''
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
