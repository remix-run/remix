import type { Assets } from '@remix-run/fetch-router'
import type { FilesConfig } from '@remix-run/assets'

type Files = readonly [
  {
    include: 'app/fixture-with-default/**/*.png'
    variants: {
      card: (data: Buffer) => Buffer
      hero: (data: Buffer) => Buffer
    }
    defaultVariant: 'card'
  },
  {
    include: 'app/fixture-required-variant/**/*.png'
    variants: {
      card: (data: Buffer) => Buffer
      hero: (data: Buffer) => Buffer
    }
  },
  {
    include: 'app/fixture-transform-only/**/*.svg'
    transform: (data: Buffer) => Buffer
  },
]

type AssertFiles = Files extends FilesConfig ? true : never
declare let assertFiles: AssertFiles
assertFiles = true

declare module '@remix-run/fetch-router' {
  interface AssetsConfig {
    files: Files
  }
}

declare let assets: Assets

assets.get('app/fixture-with-default/cover.png', 'card')
assets.get('app/fixture-with-default/cover.png')
assets.get('app/fixture-required-variant/cover.png', 'card')
// @ts-expect-error variants without defaultVariant require variant argument
assets.get('app/fixture-required-variant/cover.png')

// @ts-expect-error invalid variant should fail for matched path
assets.get('app/fixture-with-default/cover.png', 'thumbnail')
// @ts-expect-error transform-only rules should not accept variants
assets.get('app/fixture-transform-only/logo.svg', 'card')
// @ts-expect-error unmatched paths should not accept variants
assets.get('app/fixture-unmatched/entry.tsx', 'card')
