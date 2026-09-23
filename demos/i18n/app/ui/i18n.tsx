import type { Handle, RemixNode } from 'remix/ui'

import type { I18nState } from '../i18n/config.ts'

interface I18nProviderProps {
  value: I18nState
  children?: RemixNode
}

/** Provides the request-scoped translator to the server-rendered component tree. */
export function I18nProvider(handle: Handle<I18nProviderProps, I18nState>) {
  handle.context.set(handle.props.value)

  return () => handle.props.children
}

export function getI18n(handle: Handle): I18nState {
  return handle.context.get(I18nProvider)
}
