import type { RemixHotContext } from './lib/hmr.ts'

export { createAssetServer } from './lib/asset-server.ts'
export { defineFileTransform } from './lib/files/config.ts'
export type { AssetServer, AssetServerHmrOptions, AssetServerOptions } from './lib/asset-server.ts'
export type { HmrPayload, RemixHotContext } from './lib/hmr.ts'

declare global {
  interface RemixImportMetaHotContext extends RemixHotContext {}

  interface ImportMeta {
    readonly hot?: RemixImportMetaHotContext
  }
}
