import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const assets = createAssetServer({
  ...config.assets,
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction,
  watch: isDevelopment,
})

export const scriptEntry = await assets.getScriptEntry(
  path.resolve(import.meta.dirname, '../ui/public/entry.ts'),
)
