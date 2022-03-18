# Remix Auth - Auth0Strategy

Authentication using Remix Auth with the Auth0Strategy.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/remix-auth-auth0)

## Example

This is using Remix Auth and the remix-auth-auth0 packages.

The / route renders a single Sign In with Auth0 button, after the submit it starts the login flow with Auth0.

The /private routes redirects the user to / if it's not logged-in, or shows the user profile from Auth0 if it's logged-in

## Related Links

- [Remix Auth](https://github.com/sergiodxa/remix-auth)
- [Remix Auth Auth0](https://github.com/danestves/remix-auth-auth0)
- [Auth0](https://auth0.com/)
