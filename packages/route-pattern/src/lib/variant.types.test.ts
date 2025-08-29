import type { Variant } from './href.ts'

type Assert<T extends true> = T
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

// Variables ---------------------------------------------------------------

type V1 = Variant<'products/:id'>
type _assertV1 = Assert<IsEqual<V1, 'products/:id'>>

// Optionals ---------------------------------------------------------------

type V2 = Variant<'products(/:id)'>
type _assertV2 = Assert<IsEqual<V2, 'products' | 'products/:id'>>

type V3 = Variant<'products/:id(.:ext)'>
type _assertV3 = Assert<IsEqual<V3, 'products/:id' | 'products/:id.:ext'>>

// Wildcards ---------------------------------------------------------------

type V4 = Variant<'files/*'>
type _assertV4 = Assert<IsEqual<V4, 'files/*'>>

type V5 = Variant<'files/*.jpg'>
type _assertV5 = Assert<IsEqual<V5, 'files/*.jpg'>>

type V6 = Variant<'files/*path'>
type _assertV6 = Assert<IsEqual<V6, 'files/*path'>>

type V7 = Variant<'files/*(.:ext)'>
type _assertV7 = Assert<IsEqual<V7, 'files/*' | 'files/*.:ext'>>

// Enums -------------------------------------------------------------------

type V8 = Variant<'avatar.{jpg,png,gif}'>
type _assertV8 = Assert<IsEqual<V8, 'avatar.jpg' | 'avatar.png' | 'avatar.gif'>>

type V9 = Variant<'photo(.{jpg,png})'>
type _assertV9 = Assert<IsEqual<V9, 'photo' | 'photo.jpg' | 'photo.png'>>

type V10 = Variant<'files/*.{jpg,png}'>
type _assertV10 = Assert<IsEqual<V10, 'files/*.jpg' | 'files/*.png'>>

export {}
