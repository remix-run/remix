import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const assetServer = createAssetServer({
  ...config.assets,
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction,
  watch: isDevelopment,
})

const entry = path.resolve(import.meta.dirname, 'actions/public/entry.ts')

export const scriptEntry = await assetServer.getScriptEntry(entry)
