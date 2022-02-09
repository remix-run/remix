# MUI Switch Theme

Using Remix to create a persistent MUI theme switcher with HTTP cookie.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/mui-switch-theme)

## Example

This example demonstrates how to persist the theme in cookie and toggle that theme from the front-end. It also considers the user-preferred-theme by utilizing the `Sec-CH-Prefers-Color-Scheme` header ([read more](https://web.dev/user-preference-media-features-headers/)).

[app/entry.server.tsx](./app/entry.server.tsx) which creates the emotion cache and provides the theme to the component tree on the server. Styles are inserted in the html markup after `<meta name="emotion-insertion-point" content="emotion-insertion-point"/>` using emotion. The `theme` cookie is also set to the headers before sending the markup.

[app/entry.client.tsx](./app/entry.client.tsx) uses the React context to keep track of emotion cache.

[app/root.tsx](./app/root.tsx) has `<meta name="emotion-insertion-point" content="emotion-insertion-point" />` in the `html` that is very important becuase using this tag, styles are inserted in above said `entry.server.tsx`. Also a `ThemeProvider` provides the theme to the front-end from default exported React component. It is important to have same theme in both palces: `entry.server.tsx` and `root.tsx` and that is done using the `getUserTheme` function from `utils/theme.server.ts`. It has a loader that provides the theme which is also utilized in the `index` route and an action to toggle that theme which is also called from the `index` route

[app/utils/theme.server.ts](./app/utils/theme.server.ts) creates a cookie named `theme` and exports function `getUserTheme` to get theme from cookie OR system preferred theme OR default theme.

[app/themes/index.ts](./app/themes/index.ts) exports a function `getTheme` that returns a MUI Theme with providing it a theme mode `light` or `dark`

## Related Links

This example is built upon the [official example](https://github.com/mui/material-ui/tree/master/examples/remix-with-typescript) created by [mui](https://github.com/mui/material-ui/)
