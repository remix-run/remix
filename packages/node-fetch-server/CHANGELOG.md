# `node-fetch-server` CHANGELOG

This is the changelog for [`node-fetch-server`](https://github.com/mjackson/remix-the-web/tree/main/packages/node-fetch-server). It follows [semantic versioning](https://semver.org/).

## v0.4.0 (2024-11-26)

- BREAKING: Change new low-level API `createRequest(req, options)` to `createRequest(req, res, options)` so the abort signal fires on the `res`'s "end" event instead of `req`

## v0.3.0 (2024-11-20)

- Added low-level `createRequest(req, options)` and `sendResponse(res, response)` exports to assist with building custom fetch servers

## v0.2.0 (2024-11-14)

- Small perf improvement from avoiding accessing `req.headers` and reading `req.rawHeaders` instead
- Added CommonJS build

## v0.1.0 (2024-09-05)

- Initial release
