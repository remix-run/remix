# Reach UI Combobox + Remix demo.

This demo illustrates how to integrate Reach UI Combobox with Remix.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/combobox-resource-route)

## Example

As the user types into the input field, a fetcher loads suggestions from the server.

The relevant files are:

- app/routes/index.tsx - The UI route with the combobox.
- app/routes/lang-search.tsx - The Resource Route that searches languages.
- app/models/langs.ts - The "model" that holds the languages data and knows how to search it.

## Related Links

- [useFetcher](https://remix.run/api/remix#usefetcher)
- [Resource Routes](https://remix.run/guides/resource-routes)
- [Reach UI Combobox](https://reach.tech/combobox)
