import { codegenPlaceholders } from '@remix-run/assets'
import { buildConfig } from './assets.ts'

await codegenPlaceholders({ source: buildConfig.source })
console.log('Asset placeholder files generated.')
