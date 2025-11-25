import type { RequestContext } from '@remix-run/fetch-router'
import { createRedirectResponse as redirect } from '@remix-run/response/redirect'
import { lookup } from 'mrmime'

import { html, render, formatBytes, icons } from '../lib/render.ts'
import {
  parsePackagePath,
  fetchPackageMetadata,
  fetchPackageContents,
  getFilesAtPath,
  isFullyResolvedVersion,
  resolveVersion,
  PackageNotFoundError,
  VersionNotFoundError,
  InvalidPathError,
  type PackageFile,
} from '../lib/npm.ts'
import { routes } from '../routes.ts'
import { renderFileContent } from './file.ts'

export async function browseHandler(
  ctx: RequestContext<'GET', { path: string }>,
): Promise<Response> {
  let path = ctx.params.path ?? ''

  if (!path) {
    // Redirect to home if no path
    return redirect(routes.home.href())
  }

  try {
    let { name, version, filePath } = parsePackagePath(path)

    // Fetch metadata first to check if version needs resolution
    let metadata = await fetchPackageMetadata(name)

    // If the version is not fully resolved, redirect to the resolved version URL
    if (!isFullyResolvedVersion(metadata, version)) {
      let resolvedVersion = resolveVersion(metadata, version)
      let redirectUrl = `/${name}@${resolvedVersion}${filePath ? '/' + filePath : ''}`
      return redirect(redirectUrl)
    }

    let contents = await fetchPackageContents(name, version)
    let resolvedVersion = contents.metadata.version

    // Check if the path points to a file or directory
    let file = contents.files.get(filePath)

    if (filePath && file?.type === 'file') {
      // Render file content
      let fileData = await contents.getFileContent(filePath)
      if (!fileData) {
        return renderError('File not found', `The file "${filePath}" was not found in the package.`)
      }
      return renderFileContent(name, resolvedVersion, filePath, file, fileData)
    }

    // Render directory listing
    let files = getFilesAtPath(contents.files, filePath)
    return renderDirectoryListing(name, resolvedVersion, filePath, files)
  } catch (error) {
    if (error instanceof PackageNotFoundError) {
      return renderError(
        'Package not found',
        `The package "${error.packageName}" was not found on npm.`,
      )
    }
    if (error instanceof VersionNotFoundError) {
      return renderError(
        'Version not found',
        `Version "${error.version}" of package "${error.packageName}" was not found.`,
      )
    }
    if (error instanceof InvalidPathError) {
      return renderError('Invalid path', `The path "${error.path}" is not valid.`)
    }
    throw error
  }
}

function renderDirectoryListing(
  packageName: string,
  version: string,
  dirPath: string,
  files: PackageFile[],
): Response {
  let title = dirPath ? `${packageName}@${version}/${dirPath}` : `${packageName}@${version}`

  let breadcrumb = renderBreadcrumb(packageName, version, dirPath)

  // Parent directory row (only if we're in a subdirectory)
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
      file.type === 'directory' ? 'directory' : (lookup(file.name) ?? 'application/octet-stream')

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

function renderError(title: string, message: string): Response {
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
