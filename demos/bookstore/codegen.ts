import { codegenPlaceholders } from 'remix/assets'
import { getAssetsBuildConfig } from './assets.ts'

let config = await getAssetsBuildConfig()
await codegenPlaceholders({ source: config.source })
console.log('Asset placeholder files generated.')
