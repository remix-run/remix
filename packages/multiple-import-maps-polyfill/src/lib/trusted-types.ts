import { self } from './self.ts'

type TrustedHTML = string & { readonly __trustedHTML: unique symbol }
type TrustedScript = string & { readonly __trustedScript: unique symbol }

interface TrustedTypePolicy {
  createHTML(html: string): TrustedHTML
  createScript(script: string): TrustedScript
}

interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: {
      createHTML(html: string): string
      createScript(script: string): string
    },
  ): TrustedTypePolicy
}

interface TrustedTypesGlobal {
  trustedTypes?: TrustedTypePolicyFactory
  TrustedTypes?: TrustedTypePolicyFactory
}

const trustedTypesGlobal: typeof self & TrustedTypesGlobal = self

export let policy: TrustedTypePolicy | undefined
if (
  typeof trustedTypesGlobal !== 'undefined' &&
  (typeof trustedTypesGlobal.trustedTypes !== 'undefined' ||
    typeof trustedTypesGlobal.TrustedTypes !== 'undefined')
) {
  try {
    let trustedTypes = trustedTypesGlobal.trustedTypes || trustedTypesGlobal.TrustedTypes
    if (!trustedTypes) throw new Error('Trusted Types are unavailable')
    policy = trustedTypes.createPolicy('remix/multiple-import-maps-polyfill', {
      createHTML: (html) => html,
      createScript: (script) => script,
    })
  } catch {}
}

export function maybeTrustedInnerHTML(html: string): string | TrustedHTML {
  return policy ? policy.createHTML(html) : html
}

export function maybeTrustedScript(script: string): string | TrustedScript {
  return policy ? policy.createScript(script) : script
}
