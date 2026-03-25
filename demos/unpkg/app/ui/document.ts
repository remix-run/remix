import { html, type SafeHtml } from 'remix/html-template'

import { styles } from './styles.ts'

export function createDocument(title: string, content: SafeHtml): SafeHtml {
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
