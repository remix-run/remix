import type { FilesConfig, FileTransform } from './files.ts'
import { createAssetResolver } from './assets.ts'
import { createDevAssetResolver } from './dev-assets.ts'
import type { AssetsManifest } from './manifest-types.ts'

type IdTransform = FileTransform

type TypedFiles = readonly [
  {
    readonly include: 'app/images/**/*.png'
    readonly variants: {
      readonly card: IdTransform
      readonly hero: IdTransform
    }
  },
  {
    readonly include: 'app/icons/**/*.svg'
    readonly transform: IdTransform
  },
]

declare let manifest: AssetsManifest
declare let files: TypedFiles

{
  let resolveAsset = createAssetResolver<typeof files>(manifest)
  resolveAsset('app/images/logo.png', 'card')
  // @ts-expect-error variant is required for matching rule with variants and no defaultVariant
  resolveAsset('app/images/logo.png')
  // @ts-expect-error invalid variant should fail for matched path
  resolveAsset('app/images/logo.png', 'thumbnail')
}

{
  let resolveAsset = createDevAssetResolver({ root: '.', source: { files } })
  resolveAsset('app/images/logo.png', 'hero')
  // @ts-expect-error transform-only paths should reject variants
  resolveAsset('app/icons/logo.svg', 'card')
}

let broadFiles: FilesConfig = [{ include: '**/*', transform: (data) => data }]
{
  let resolveAsset = createAssetResolver<typeof broadFiles>(manifest)
  resolveAsset('anything/at/all.ts', 'any-variant-name')
}
