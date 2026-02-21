import {
  clientEntry as baseClientEntry,
  type EntryComponent,
  type Handle,
  type RemixNode,
  type SerializableProps,
  type SerializableValue,
} from 'remix/component'

export function clientEntry<
  context = Record<string, never>,
  setup extends SerializableValue = undefined,
  props extends SerializableProps = {},
>(
  assets: ImportAssetsResult,
  exportName: string,
  Component: (handle: Handle<context>, setup: setup) => (props: props) => RemixNode,
): EntryComponent<context, setup, props> {
  if (typeof document === 'object') return Component as EntryComponent<context, setup, props>

  if (!assets.entry) throw new Error('Assets must be entries')

  return baseClientEntry(
    {
      exportName,
      js: [{ src: assets.entry }, ...assets.js.map((asset) => ({ src: asset.href }))],
      css: assets.css,
    },
    Component,
  )
}
