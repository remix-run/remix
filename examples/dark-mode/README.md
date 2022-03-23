# Dark Mode Example

This example shows how you can add dark mode theming to your app

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/dark-mode)

## Example

In this example, we have a button that toggles the current theme (light / dark). The current value is stored in React context and is used as the className of `<html>` (see [app/root.tsx](app/root.tsx)). Clicking the button toggles the theme, which updates the className, which updates the CSS variables, resulting in the background colour updating (see [app/styles/styles.css](app/styles/styles.css)).

When the theme value updates, we update a cookie value so that the server can persist the theme value in the future (e.g. when the page is refreshed).

When the page is initially rendered, the server first checks whether a cookie from a previous session has been set. If so, we use the cookie value as the initial theme value. If not, we leave it to the client to figure out the initial value. The client uses `prefers-color-scheme` to use any system preferences the user have. If they don't have any preferences, we default to LIGHT mode.

While not essential, the cookie uses a secret to sign the value (see [app/utils/theme.server.ts](app/utils/theme.server.ts)). This value comes from the environment variable `SESSION_SECRET` (make sure to set it before running the app or an error will be thrown).

The Themed component is used to conditionally render two components depending on current theme. If a theme preference hasn't been set, the server renders both components and the client uses `ThemeBody` in [theme-provider.tsx](app/utils/theme-provider.tsx) to remove the component that is not associated with the user's theme preferences.

## Related Links

- [Creating cookie sessions in the Remix docs](https://remix.run/docs/en/v1/api/remix#createcookiesessionstorage)
- [useFetcher in the Remix docs](https://remix.run/docs/en/v1/api/remix#usefetcher) (used to tell the server to update the cookie value when the theme changes)
- [Blog post with complete explanation of each part of the code](https://www.mattstobbs.com/remix-dark-mode/)
