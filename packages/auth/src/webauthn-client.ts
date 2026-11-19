export { createPasskey, getPasskey, isWebAuthnSupported } from './lib/webauthn-client.ts'

export type { GetPasskeyInit, PasskeyRequestInit } from './lib/webauthn-client.ts'
export type {
  WebAuthnAuthenticationOptionsJSON,
  WebAuthnAuthenticationResponseJSON,
  WebAuthnCredentialDescriptorJSON,
  WebAuthnRegistrationOptionsJSON,
  WebAuthnRegistrationResponseJSON,
} from './lib/providers/webauthn.ts'
