# `node-fetch-server` CHANGELOG

This is the changelog for [`node-fetch-server`](https://github.com/mjackson/remix-the-web/tree/main/packages/node-fetch-server). It follows [semantic versioning](https://semver.org/).

## v0.5.0 (2024-12-09)

- Expose `createHeaders(req: http.IncomingMessage): Headers` API for creating headers from the headers of incoming request objects.
- Update `sendResponse` to use an object to add support for libraries such as express while maintaining `node:http` and `node:https` compatibility.

## v0.4.1 (2024-12-04)

- Fix low-level API example in the README

## v0.4.0 (2024-11-26)

- BREAKING: Change `createRequest` signature to `createRequest(req, res, options)` so the abort signal fires on the `res`'s "end" event instead of `req`

## v0.3.0 (2024-11-20)

- Added `createRequest(req: http.IncomingMessage, options): Request` and `sendResponse(res: http.ServerResponse, response: Response): Promise<void>` exports to assist with building custom fetch servers

## v0.2.0 (2024-11-14)

- Small perf improvement from avoiding accessing `req.headers` and reading `req.rawHeaders` instead
- Added CommonJS build

## v0.1.0 (2024-09-05)

- Initial release
