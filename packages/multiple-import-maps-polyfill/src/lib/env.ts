import { self } from './self.ts'

export const hasDocument = typeof document !== 'undefined'

export let nonce = ''
if (hasDocument) {
  let nonceElement = document.querySelector<HTMLScriptElement>('script[nonce]')
  if (nonceElement) nonce = nonceElement.nonce || nonceElement.getAttribute('nonce') || ''
}

export const dynamicImport = (u: string): Promise<Record<string, unknown>> => import(u)

export const defaultFetchOpts = { credentials: 'same-origin' } satisfies RequestInit

export const baseUrl = hasDocument
  ? document.baseURI
  : typeof location !== 'undefined'
    ? `${location.protocol}//${location.host}${
        location.pathname.includes('/')
          ? location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1)
          : location.pathname
      }`
    : 'about:blank'

export const createBlob = (source: string): string =>
  URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))

const dispatchError = (error: unknown) =>
  self.dispatchEvent(Object.assign(new Event('error'), { error }))

export const throwError = (err: unknown): void => {
  ;(self.reportError || dispatchError)(err)
}

export const fromParent = (parent?: string): string => (parent ? ` imported from ${parent}` : '')
