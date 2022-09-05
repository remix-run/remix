# TODO: Example app with leaflet map

This is a very basic example of remix app with leaflet map.

- [Remix Docs](https://remix.run/docs)

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/leaflet)

## Example

This example shows how to use Leaflet with Remix.

Relevant files:

- [app/client-only.tsx](app/client-only.tsx)
- [app/map.client.tsx](app/map.client.tsx)

Leaflet cannot be rendered on the server side, so we're using the `ClientOnly` component to display a skeleton instead.
It's important to add the `.client.tsx` suffix on `Map` component. Otherwise, a similar error will be displayed:

```js
Error [ERR_REQUIRE_ESM]: require() of ES Module /remix/examples/leaflet/node_modules/react-leaflet/lib/index.js from /remix/examples/leaflet/build/index.js not supported.
```

Make sure you don't import the leaflet styles from `node_modules`, but use a CDN link ([https://unpkg.com/leaflet@1.8.0/dist/leaflet.css](https://unpkg.com/leaflet@1.8.0/dist/leaflet.css)).
The styles from `node_modules` will cause map assets issues (ex: 404 for marker icons)

## Related Links

Link to documentation or other related examples.

- [Leaflet docs](https://leafletjs.com/download.html)
- [React Leaflet docs](https://react-leaflet.js.org/)
