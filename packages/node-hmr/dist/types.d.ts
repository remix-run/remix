import type { ImportMetaHot } from './lib/runtime.ts'

export type { ImportMetaHot } from './lib/runtime.ts'

declare global {
  interface ImportMeta {
    readonly hot?: ImportMetaHot
  }
}
