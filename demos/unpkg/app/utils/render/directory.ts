import { detectMimeType } from '@remix-run/mime'

import type { PackageFile } from '../npm.ts'
import { html, render, formatBytes, icons } from '../render.ts'
import { renderBreadcrumb } from './breadcrumb.ts'

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
    let mimeType =
      file.type === 'directory'
        ? 'directory'
        : (detectMimeType(file.name) ?? 'application/octet-stream')

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

function getParentPath(dirPath: string): string {
  let parts = dirPath.split('/')
  parts.pop()
  return parts.length > 0 ? '/' + parts.join('/') : ''
}
