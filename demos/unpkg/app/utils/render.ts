import { html, type SafeHtml } from '@remix-run/html-template'
import { createHtmlResponse } from '@remix-run/response/html'

export { html }

const styles = /* css */ `
  * {
    box-sizing: border-box;
  }

  body {
    font-family: Helvetica, Arial, sans-serif;
    line-height: 1.5;
    color: #24292f;
    background: #fff;
    margin: 0;
    padding: 20px;
    max-width: 1000px;
    margin: 0 auto;
  }

  a {
    color: #0969da;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1rem;
    border-bottom: 1px solid #d0d7de;
    padding-bottom: 0.5rem;
  }

  .brand {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .breadcrumb {
    font-size: 0.875rem;
    margin-bottom: 1rem;
    color: #57606a;
  }

  .breadcrumb a {
    color: #0969da;
  }

  .file-browser {
    border: 1px solid #d0d7de;
    border-radius: 6px;
    overflow: hidden;
  }

  .file-browser table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .file-browser th {
    text-align: left;
    padding: 8px 16px;
    background: #f6f8fa;
    border-bottom: 1px solid #d0d7de;
    font-weight: 600;
  }

  .file-browser td {
    padding: 0;
    border-bottom: 1px solid #d0d7de;
  }

  .file-browser tr:last-child td {
    border-bottom: none;
  }

  .file-browser tbody tr:hover {
    background: #f6f8fa;
  }

  .file-browser td a {
    display: block;
    padding: 8px 16px;
    color: inherit;
    text-decoration: none;
  }

  .file-browser td a:hover {
    text-decoration: none;
  }

  .file-browser .name a {
    color: #0969da;
  }

  .file-browser .size {
    text-align: right;
    width: 100px;
  }

  .file-browser .size a {
    color: #57606a;
  }

  .file-browser .type {
    width: 180px;
    white-space: nowrap;
  }

  .file-browser .type a {
    color: #57606a;
  }

  .file-browser .icon {
    width: 32px;
  }

  .file-browser .icon a {
    padding: 8px;
    padding-right: 0;
  }

  .file-browser .icon svg {
    display: block;
    margin: 0 auto;
  }

  .icon-file, .icon-dir {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 600px) {
    body {
      padding: 12px;
    }

    .file-browser .type,
    .file-browser th.type {
      display: none;
    }

    .file-browser .icon {
      width: 24px;
    }

    .file-browser .icon a {
      padding: 8px 4px;
    }

    .file-browser td a {
      padding: 8px 12px;
    }

    .file-browser th {
      padding: 8px 12px;
    }

    .file-browser .size {
      width: 70px;
    }
  }

  .file-content {
    border: 1px solid #d0d7de;
    border-radius: 6px;
    overflow: hidden;
  }

  .file-content pre {
    margin: 0;
    padding: 16px;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    line-height: 1.45;
    background: #f6f8fa;
  }

  .file-content img {
    max-width: 100%;
    padding: 16px;
  }

  .error {
    padding: 16px;
    background: #ffebe9;
    border: 1px solid #ff8182;
    border-radius: 6px;
    color: #cf222e;
  }

  .info {
    padding: 16px;
    background: #ddf4ff;
    border: 1px solid #54aeff;
    border-radius: 6px;
    color: #0969da;
  }

  .home-content {
    max-width: 600px;
  }

  .home-content p {
    margin: 1rem 0;
    color: #57606a;
  }

  .home-content code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    background: #f6f8fa;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.875em;
  }

  .examples {
    margin-top: 2rem;
  }

  .examples h2 {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }

  .examples ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .examples li {
    padding: 0.25rem 0;
  }

  .package-info {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 0.875rem;
    color: #57606a;
    margin-bottom: 1rem;
  }
`

export function layout(title: string, content: SafeHtml): SafeHtml {
  return html`
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style>
          ${styles}
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `
}

export function render(title: string, content: SafeHtml, init?: ResponseInit): Response {
  return createHtmlResponse(layout(title, content), init)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' kB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// Minimal SVG icons
export let icons = {
  file: html`<svg
    class="icon-file"
    viewBox="0 0 16 16"
    fill="none"
    stroke="#57606a"
    stroke-width="1.5"
  >
    <path d="M3 1.5h6.5L13 5v9.5H3z" />
    <path d="M9.5 1.5V5H13" />
  </svg>`,

  directory: html`<svg
    class="icon-dir"
    viewBox="0 0 16 16"
    fill="none"
    stroke="#57606a"
    stroke-width="1.5"
  >
    <path d="M1.5 3.5h4l1.5 2h7.5v8h-13z" />
  </svg>`,
}
