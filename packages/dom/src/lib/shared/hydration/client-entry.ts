import type { Component, RenderValue } from '@remix-run/reconciler'

export type SerializablePrimitive = string | number | boolean | null | undefined

export type SerializableObject = {
  [key: string]: SerializableValue
}

export type SerializableArray = SerializableValue[]

export type SerializableValue =
  | SerializablePrimitive
  | SerializableObject
  | SerializableArray
  | RenderValue

export type SerializableProps = {
  [K in string]: SerializableValue
}

export type EntryMetadata = {
  $entry: true
  $moduleUrl: string
  $exportName: string
}

export type EntryComponent<setup = undefined, props extends SerializableProps = {}> = Component<
  setup,
  props,
  RenderValue
> &
  EntryMetadata

export type HydrationData = {
  moduleUrl: string
  exportName: string
  props: Record<string, unknown>
}

export function clientEntry<setup = undefined, props extends SerializableProps = {}>(
  href: string,
  component: Component<setup, props, RenderValue>,
): EntryComponent<setup, props>
export function clientEntry(href: string, component: Component<any, any, RenderValue>) {
  let [moduleUrl, exportName] = href.split('#')
  if (!moduleUrl) {
    throw new Error('clientEntry() requires a module URL')
  }
  let finalExportName = exportName || component.name
  if (!finalExportName) {
    throw new Error(
      'clientEntry() requires either an export name in the href (e.g. "/js/module.js#ComponentName") or a named component function',
    )
  }

  let entry = component as EntryComponent<any, any>
  entry.$entry = true
  entry.$moduleUrl = moduleUrl
  entry.$exportName = finalExportName
  return entry
}

export function isEntry(component: unknown): component is EntryComponent {
  return Boolean(component && typeof component === 'function' && (component as any).$entry === true)
}

export function serializeHydrationProps(props: Record<string, unknown>) {
  let seen = new Set<object>()
  assertSerializable(props, '$', seen)
  return JSON.parse(JSON.stringify(props)) as Record<string, unknown>
}

function assertSerializable(value: unknown, path: string, seen: Set<object>) {
  if (value == null) return
  let kind = typeof value
  if (kind === 'string' || kind === 'number' || kind === 'boolean') return
  if (kind === 'undefined') return
  if (kind === 'bigint' || kind === 'symbol' || kind === 'function') {
    throw new Error(`clientEntry props must be serializable (invalid ${kind} at ${path})`)
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      assertSerializable(value[index], `${path}[${index}]`, seen)
    }
    return
  }
  if (typeof value === 'object') {
    let objectValue = value as Record<string, unknown>
    if (seen.has(objectValue)) {
      throw new Error(`clientEntry props must be serializable (circular value at ${path})`)
    }
    seen.add(objectValue)
    for (let key in objectValue) {
      assertSerializable(objectValue[key], `${path}.${key}`, seen)
    }
    seen.delete(objectValue)
  }
}
