import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

export const assets = createAssetServer({
  ...config.assets,
  minify: process.env.NODE_ENV !== 'development',
  fingerprint: process.env.NODE_ENV !== 'development',
  watch: false,
})
