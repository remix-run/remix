# uwebsockets-js

Remix-owned npm distribution of uWebSockets.js. A small ESM/CJS facade selects an optional native package for the current OS and architecture. Its own tarball contains no native binaries.

## Installation

```sh
npm i remix
```

Applications using `remix/node-serve` receive this dependency automatically. Applications using the upstream API directly can install `@remix-run/uwebsockets-js`.

## Supported Platforms

Node.js 20, 22, 24, and 25 (ABIs 115, 127, 137, and 141) on macOS arm64/x64, glibc Linux arm64/x64, and Windows x64. Keep optional dependencies enabled. Unsupported platforms can use `remix/node-fetch-server`.

Both `import * as uWS from '@remix-run/uwebsockets-js'` and `require('@remix-run/uwebsockets-js')` expose the upstream API. The ESM entry also supplies the upstream default export and `DeclarativeResponse`.

## Updating the Native Payload

[upstream.json](https://github.com/remix-run/remix/blob/main/packages/uwebsockets-js/upstream.json) pins the upstream release, distribution commit, native source commit, archive SHA-256, and Node ABIs. Remix package versions are independent of the upstream version.

From the repository root:

```sh
node scripts/sync-uwebsockets.ts
pnpm --filter @remix-run/uwebsockets-js test
pnpm --filter @remix-run/node-serve test
```

The sync script verifies the archive before extracting the upstream wrappers, types, and platform binaries. Downloaded archives and generated native payloads are ignored by Git. Use `--current` to sync only the current platform. Platform package builds and packing regenerate their payloads; consumers download only npm tarballs and run no install scripts.

When updating upstream, update the pin and verified checksum, sync all packages, and add change files for the facade and platform packages. The facade uses exact optional workspace versions so each release selects matching platform packages. `remix.internal` keeps these implementation packages out of the umbrella package's direct dependencies and exports.

## Related Packages

- [node-serve](https://github.com/remix-run/remix/tree/main/packages/node-serve) — Fetch API server using this transport

## Related Work

- [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) — upstream native transport

## License

Apache-2.0. See [LICENSE](https://github.com/remix-run/remix/blob/main/packages/uwebsockets-js/LICENSE) and [upstream.json](https://github.com/remix-run/remix/blob/main/packages/uwebsockets-js/upstream.json) for source attribution.
