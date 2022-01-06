# NProgress

Shows how to use NProgress to show a progress bar when doing any client-side navigation.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/nprogress)

## Example

It shows how to load NProgress, link to their styles from the node_modules folder, and use the useTransition hook to know when a client-side transition, both submit or navigation, is happening to start the progress bar.

To visualize it, the `/` route has a link to `/slow-page` whose loader takes one second to load so the progress bar is noticiable for more time

## Related Links

- [NProgress](https://ricostacruz.com/nprogress/)
- [useTransition](https://remix.run/docs/en/v1/api/remix#usetransition)
