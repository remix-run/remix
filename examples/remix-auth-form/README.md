# Remix Auth - FormStrategy

Authentication using Remix Auth with the FormStrategy.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/remix-auth-form)

## Example

This is using Remix Auth and the `remix-auth-form` packages.

The `/login` route renders a form with a email and password input. After a submit it runs some validations and store the user email in the session.

The `/private` routes redirects the user to `/login` if it's not logged-in, or shows the user email and a logout form if it's logged-in.

## Related Links

- [Remix Auth](https://github.com/sergiodxa/remix-auth)
- [Remix Auth Form](https://github.com/sergiodxa/remix-auth-form)
