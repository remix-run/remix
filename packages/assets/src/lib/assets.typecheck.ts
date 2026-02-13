import type { FilesConfig, FileTransform } from './files.ts'
import { createAssets } from './assets.ts'
import { createDevAssets } from './dev-assets.ts'
import type { AssetManifest } from './manifest-types.ts'

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

declare let manifest: AssetManifest
declare let files: TypedFiles

let typedFromManifest = createAssets<typeof files>(manifest)
let typedFromDev = createDevAssets({ root: '.', files })

typedFromManifest.get('app/images/logo.png', 'card')
typedFromDev.get('app/images/logo.png', 'hero')

// @ts-expect-error variant is required for matching rule with variants and no defaultVariant
typedFromManifest.get('app/images/logo.png')
// @ts-expect-error invalid variant should fail for matched path
typedFromManifest.get('app/images/logo.png', 'thumbnail')
// @ts-expect-error transform-only paths should reject variants
typedFromDev.get('app/icons/logo.svg', 'card')

let broadFiles: FilesConfig = [{ include: '**/*', transform: (data) => data }]
let broadTyped = createAssets<typeof broadFiles>(manifest)
broadTyped.get('anything/at/all.ts', 'any-variant-name')
