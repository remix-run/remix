# dpop-fetch

DPoP-aware fetch utilities for Remix. Use `dpop-fetch` to turn the token bundle returned by `remix/auth` Atmosphere callbacks into a `fetch` function that automatically signs requests with DPoP proofs.

## Features

- DPoP proof generation for standard `fetch` requests
- Automatic `Authorization: DPoP ...` header wiring
- Single-retry handling for `use_dpop_nonce` challenges
- Accepts the token shape returned by `finishExternalAuth()` without reshaping

## Installation

```sh
npm i remix
```

## Usage

```ts
import { finishExternalAuth, refreshExternalAuth } from 'remix/auth'
import { createFetch } from 'remix/dpop-fetch'

let { result } = await finishExternalAuth(atmosphereProvider, context)
await saveAtmosphereTokens(result.tokens)

async function createAtmosphereApiFetch() {
  let tokens = await readAtmosphereTokens()
  if (tokens == null) {
    throw new Error('Missing Atmosphere tokens')
  }

  if (tokens.expiresAt != null && tokens.expiresAt.getTime() <= Date.now()) {
    tokens = (await refreshExternalAuth(atmosphereProvider, tokens)).tokens
    await saveAtmosphereTokens(tokens)
  }

  return createFetch({
    ...tokens,
    async onDpopChange(dpop) {
      await saveAtmosphereTokens({
        ...tokens,
        dpop,
      })
    },
  })
}

let atmosphereFetch = await createAtmosphereApiFetch()
let response = await atmosphereFetch(
  'https://pds.example.com/xrpc/app.bsky.actor.getProfile?actor=alice.example.com',
)
let profile = await response.json()
```

`createFetch()` expects `accessToken`, and it also accepts `refreshToken` and `expiresAt` so you can pass the full token object returned by `remix/auth` directly. Use `onDpopChange` when you need to persist a nonce learned from a DPoP challenge or response header. `createFetch()` does not refresh tokens for you, so apps should persist the token bundle from `finishExternalAuth()` and recreate the fetch instance later after calling `refreshExternalAuth()` when a follow-up request needs a fresh access token.

## Related Packages

- [`auth`](https://github.com/remix-run/remix/tree/main/packages/auth) - External auth helpers, including Atmosphere callback handling that returns DPoP-bound token state

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
