import * as path from 'node:path'

import { renderSite } from './render-site.ts'

const outputDirectory = path.resolve(import.meta.dirname, '../dist')
const count = await renderSite(outputDirectory)

console.log(`Rendered ${count} pages and copied all assets to ${outputDirectory}`)
