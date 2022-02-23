# CMS Collected Notes

Shows how to use the Collected Notes CMS as a Headless CMS to provide content of a Remix app.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/cms-collected-notes)

## Example

The example creates a `cn.server.ts` file to create the Collected notes API client instance.

The route `/` shows the Collected Notes site and list of notes, a search form to use the Collected Notes search API and basic next/prev pagination at the end of the list.

There's then a `/:slug` URL to show the note content.

## Related Links

- [Collected Notes](https://collectednotes.com)
- [API Docs](https://collectednotes.com/blog/api)
- [TS API Client](https://github.com/sergiodxa/collected-notes)
