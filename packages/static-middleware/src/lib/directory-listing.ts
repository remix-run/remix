import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { html } from '@remix-run/html-template'
import { createHtmlResponse } from '@remix-run/response/html'
import { detectMimeType } from '@remix-run/mime'

interface DirectoryEntry {
  name: string
  isDirectory: boolean
  size: number
  type: string
}

export async function generateDirectoryListing(
  dirPath: string,
  pathname: string,
): Promise<Response> {
  let entries: DirectoryEntry[] = []

  try {
    let dirents = await fsp.readdir(dirPath, { withFileTypes: true })

    for (let dirent of dirents) {
      let fullPath = path.join(dirPath, dirent.name)
      let isDirectory = dirent.isDirectory()
      let size = 0
      let type = ''

      if (isDirectory) {
        size = await calculateDirectorySize(fullPath)
      } else {
        try {
          let stats = await fsp.stat(fullPath)
          size = stats.size
          let mimeType = detectMimeType(dirent.name)
          type = mimeType || 'application/octet-stream'
        } catch {
          // Unable to stat file, use defaults
        }
      }

      entries.push({
        name: dirent.name,
        isDirectory,
        size,
        type,
      })
    }
  } catch {
    return new Response('Error reading directory', { status: 500 })
  }

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })

  // Build table rows
  let tableRows = []

  let folderIcon = html.raw`<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h4.5l1.5 1.5h6v8h-12z"/></svg>`
  let fileIcon = html.raw`<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2h7l3 3v9H3z"/><path d="M10 2v3h3"/></svg>`

  // Add parent directory link if not at root
  if (pathname !== '/' && pathname !== '') {
    let parentPath = pathname.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/'
    tableRows.push(html`
      <tr class="file-row">
        <td class="name-cell">
          <a href="${parentPath}">${folderIcon} ..</a>
        </td>
        <td class="size-cell"></td>
        <td class="type-cell"></td>
      </tr>
    `)
  }

  for (let entry of entries) {
    let icon = entry.isDirectory ? folderIcon : fileIcon
    let href = pathname.endsWith('/') ? pathname + entry.name : pathname + '/' + entry.name
    let sizeDisplay = formatFileSize(entry.size)
    let typeDisplay = entry.isDirectory ? 'Folder' : entry.type

    tableRows.push(html`
      <tr class="file-row">
        <td class="name-cell">
          <a href="${href}">${icon} ${entry.name}</a>
        </td>
        <td class="size-cell">${sizeDisplay}</td>
        <td class="type-cell">${typeDisplay}</td>
      </tr>
    `)
  }

  return createHtmlResponse(html`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Index of ${pathname}</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
              Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 2rem 1rem;
            background: #fff;
            color: #333;
            font-size: 14px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          h1 {
            margin: 0 0 1rem 0;
            padding: 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: #333;
          }
          .icon {
            width: 14px;
            height: 14px;
            display: inline-block;
            vertical-align: text-top;
            margin-right: 0.5rem;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e0e0e0;
          }
          thead tr {
            background: #fafafa;
          }
          th {
            padding: 0.5rem 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.8125rem;
            color: #666;
            border-bottom: 1px solid #e0e0e0;
          }
          td {
            border-bottom: 1px solid #f0f0f0;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .file-row {
            position: relative;
          }
          .file-row:hover {
            background: #fafafa;
          }
          .name-cell {
            width: 50%;
            padding: 0;
          }
          .name-cell a {
            display: block;
            padding: 0.375rem 1rem;
            color: #0066cc;
            text-decoration: none;
          }
          .name-cell a::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .file-row:hover .name-cell a {
            text-decoration: underline;
          }
          .size-cell {
            width: 25%;
            padding: 0.375rem 1rem;
            text-align: left;
            color: #666;
            font-variant-numeric: tabular-nums;
          }
          .type-cell {
            width: 25%;
            padding: 0.375rem 1rem;
            color: #666;
            white-space: nowrap;
          }
          @media (max-width: 768px) {
            body {
              padding: 1rem 0.5rem;
            }
            h1 {
              font-size: 1.125rem;
              margin-bottom: 0.75rem;
            }
            thead {
              display: none;
            }
            .name-cell a,
            .size-cell,
            .type-cell {
              padding: 0.375rem 0.75rem;
            }
            .type-cell {
              display: none;
            }
            .name-cell {
              width: 60%;
            }
            .size-cell {
              width: 40%;
              text-align: right;
            }
          }
          @media (max-width: 480px) {
            body {
              font-size: 13px;
            }
            .name-cell a,
            .size-cell,
            .type-cell {
              padding: 0.375rem 0.5rem;
            }
            h1 {
              font-size: 1rem;
            }
            .icon {
              width: 12px;
              height: 12px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Index of ${pathname}</h1>
          <table>
            <thead>
              <tr>
                <th class="name">Name</th>
                <th class="size">Size</th>
                <th class="type">Type</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `)
}

async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0

  try {
    let dirents = await fsp.readdir(dirPath, { withFileTypes: true })

    for (let dirent of dirents) {
      let fullPath = path.join(dirPath, dirent.name)

      try {
        if (dirent.isDirectory()) {
          totalSize += await calculateDirectorySize(fullPath)
        } else if (dirent.isFile()) {
          let stats = await fsp.stat(fullPath)
          totalSize += stats.size
        }
      } catch {
        // Skip files/folders we can't access
      }
    }
  } catch {
    // If we can't read the directory, return 0
  }

  return totalSize
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  let units = ['B', 'kB', 'MB', 'GB', 'TB']
  let i = Math.floor(Math.log(bytes) / Math.log(1024))
  let size = bytes / Math.pow(1024, i)
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}
