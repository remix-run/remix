import { defineFiles } from './files.ts'
import type { AssetResolver, FileTransform, TypedAssetResolver, VariantArg } from './files.ts'

type Assert<value extends true> = value
type IsEqual<a, b> =
  (<t>() => t extends a ? 1 : 2) extends <t>() => t extends b ? 1 : 2 ? true : false

type IdTransform = FileTransform

type FilesNoVariants = [
  {
    include: 'fixtures/no-variants/**/*.png'
    transform: IdTransform
  },
]

type FilesWithVariants = [
  {
    include: 'fixtures/required-variant/**/*.png'
    variants: {
      card: IdTransform
      hero: IdTransform
    }
  },
]

type FilesWithDefault = [
  {
    include: 'fixtures/default-variant/**/*.png'
    variants: {
      optimized: IdTransform
      thumbnail: IdTransform
    }
    defaultVariant: 'optimized'
  },
]

type FilesMixed = [
  {
    include: 'fixtures/default-variant/**/*.png'
    variants: {
      optimized: IdTransform
      thumbnail: IdTransform
    }
    defaultVariant: 'optimized'
  },
  {
    include: 'fixtures/transform-only/**/*.svg'
    transform: IdTransform
  },
]

type FilesOverlapping = [
  {
    include: 'fixtures/overlap/**/*.png'
    variants: {
      card: IdTransform
    }
  },
  {
    include: 'fixtures/overlap/nested/**/*.png'
    variants: {
      hero: IdTransform
    }
  },
]

type NoVariantsDisallowVariant = Assert<
  IsEqual<VariantArg<FilesNoVariants, 'fixtures/no-variants/a.png'>, [variant?: never]>
>

type VariantsRequireVariant = Assert<
  IsEqual<
    VariantArg<FilesWithVariants, 'fixtures/required-variant/a.png'>,
    [variant: 'card' | 'hero']
  >
>

type DefaultVariantMakesOptional = Assert<
  IsEqual<
    VariantArg<FilesWithDefault, 'fixtures/default-variant/a.png'>,
    [variant?: 'optimized' | 'thumbnail']
  >
>

type UnmatchedPathDisallowVariant = Assert<
  IsEqual<VariantArg<FilesMixed, 'fixtures/unmatched/a.txt'>, [variant?: never]>
>

type TransformOnlyDisallowVariant = Assert<
  IsEqual<VariantArg<FilesMixed, 'fixtures/transform-only/logo.svg'>, [variant?: never]>
>

type OverlappingGlobsUnionVariants = Assert<
  IsEqual<
    VariantArg<FilesOverlapping, 'fixtures/overlap/nested/cover.png'>,
    [variant: 'card' | 'hero']
  >
>

type BroadAssetResolverVariantIsString = Assert<
  IsEqual<Parameters<AssetResolver>[1], string | undefined>
>

declare let resolveWithVariants: TypedAssetResolver<FilesWithVariants>
resolveWithVariants('fixtures/required-variant/a.png', 'card')
// @ts-expect-error variants without defaultVariant require variant argument
resolveWithVariants('fixtures/required-variant/a.png')
// @ts-expect-error invalid variant should fail for matched path
resolveWithVariants('fixtures/required-variant/a.png', 'invalid')
// @ts-expect-error unmatched path should not accept variants
resolveWithVariants('fixtures/unmatched/entry.tsx', 'card')

defineFiles([
  {
    include: 'fixtures/default-variant/**/*.png',
    variants: {
      card: (data) => data,
      hero: (data) => data,
    },
    defaultVariant: 'card',
  },
])

defineFiles([
  // @ts-expect-error defaultVariant must match declared variant names
  {
    include: 'fixtures/default-variant/**/*.png',
    variants: {
      card: (data) => data,
      hero: (data) => data,
    },
    defaultVariant: 'thumbnail',
  },
])

defineFiles([
  // @ts-expect-error defaultVariant requires variants
  {
    include: 'fixtures/default-variant/**/*.png',
    transform: (data) => data,
    defaultVariant: 'card',
  },
])
