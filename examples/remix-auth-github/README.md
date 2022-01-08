# Remix Auth - GitHubStrategy

Authentication using Remix Auth with the GitHubStrategy.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/remix-auth-github)

## Example

This is using Remix Auth and the `remix-auth-github` packages.

The `/` route renders a single Sign In with GitHub button, after the submit it starts the login flow with GitHub.

The `/private` routes redirects the user to `/login` if it's not logged-in, or shows the user profile from GitHub if it's logged-in

## Related Links

- [Remix Auth](https://github.com/sergiodxa/remix-auth)
- [Remix Auth GitHub](https://github.com/sergiodxa/remix-auth-github)
