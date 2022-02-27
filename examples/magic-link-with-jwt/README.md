# Magic Link with JWT

Basic implementation of using [Magic Link](https://magic.link) for user 
authorization. This example showcases how to use the `loginWithMagicLink` 
provider, which is a passwordless authentication mechanism that sends the 
user a link via email. The user click the link in the email within the 
allotted time frame to gain access, but it is not required that the link be 
followed on in the same browser. For example, the user could click the 
emailed link on a mobile device while logging in via a laptop.

Once the user logs in, a JWT is created with the user metadata and stored in 
a cookie session. The same information is also stored via React context so that 
it is easily accessible to the entire app with the custom `useUserContext()` 
hook.

Note that there are some [Third-Party Module Side Effects](https://remix.run/docs/en/v1/guides/constraints#third-party-module-side-effects) in the 
`@magic-sdk/admin` module, and so those modules are used exclusively in the 
files with the `server` filename hint as discussed in [No Module Side 
Effects](https://remix.run/docs/en/v1/guides/constraints#no-module-side-effects). Note that using this module in `loader` or `action` methods may result in errors.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/magic-link-with-jwt)

## Example

For this example to work, you will need to create a free account with [Magic 
Link](https://magic.link) and retrieve your publishable key and secret key. 
Substitute those keys in `./.env-example` and `./constants-example.ts` and 
rename both of those files to remove '-example' from the filename. You will 
also need to include a value in `./.env` for `JWT_SECRET` Note that 
`./constants.ts` is not included in `./.gitignore`. 

## Related Links

- [Magic Link](https://magic.link)
- [Bootstrap React](https://react-bootstrap.github.io)
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
