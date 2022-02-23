# Infinite scrolling

This example shows a minimal implementation of infinite scrolling that uses [useFetcher](https://remix.run/docs/en/v1/api/remix#usefetcher) and [URL Search Params](https://remix.run/docs/en/v1/guides/data-loading#url-search-params) to query a paginated [jokes API](https://icanhazdadjoke.com).

To keep it simple, [react-infinite-scroller](https://github.com/danbovey/react-infinite-scroller) is used as the scrolling React component.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/infinite-scrolling)

## Example

The pagination of the API is controlled by the `page` query string parameter, which, when provided, returns a limited number of results per page (default 20). In addition to the `results`, it also returns `total pages` which is useful for determining when to stop querying.

The first time the page is loaded, it calls the API with `?page=1` which is the default value for the `page` param from the `loader`. The `useLoaderData` hook is used to get the first request's response, which is then utilized as the initial value for the `jokes` state.

Following that, the `useFetcher` hook is used to make subsequent calls that increment the `page` param whenever more results should be loaded, and the response is accessed via `fetcher.data`. For this reason, everytime a new page is successfully queried, within the `useEffect` hook, the data is spread in the `jokes` state to combine the results together

`react-infinite-scroller` uses event listeners on window to determine when to call `handleLoadMore` and request a new page only if `hasMore` is **true**.

`canLoadMore` is used to avoid calling the API with the same `page` param, as the scrolling component does not know about the status of the previous call.

## Related Links

- [react-infinite-scroller](https://github.com/danbovey/react-infinite-scroller)
- [API docs](https://icanhazdadjoke.com/api)
- Remix docs:
  - [useFetcher](https://remix.run/docs/en/v1/api/remix#usefetcher)
  - [URL Search Params](https://remix.run/docs/en/v1/guides/data-loading#url-search-params)
