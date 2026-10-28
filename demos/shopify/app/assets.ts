import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const assetServer = createAssetServer({
  ...config.assets,
  minify: isProduction,
  fingerprint: isProduction,
  watch: isDevelopment,
})

function getHref(file: string) {
  return assetServer.getHref(path.resolve(import.meta.dirname, file))
}

export const assets = {
  styles: await getHref('ui/public/styles.css'),
  font: await getHref('ui/public/shopify.woff2'),
  logo: await getHref('ui/public/logo.svg'),
  mediaScript: (
    await assetServer.getScriptEntry(path.resolve(import.meta.dirname, 'ui/public/media.js'))
  ).href,
  pricingStyles: await getHref('actions/public/pricing.css'),
  agenticStyles: await getHref('actions/public/agentic.css'),
  heroPoster: await getHref('actions/public/hero-poster.webp'),
  agenticHeroPoster: await getHref('actions/public/agentic-hero-poster.webp'),
  testimonialCaptions: await getHref('actions/public/testimonial.vtt'),
}
