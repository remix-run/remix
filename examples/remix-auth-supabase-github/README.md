# Remix Auth - Supabase Strategy with oauth (GitHub)

Authentication using `signIn with oauth provider`.

[Enable GitHub Auth for your project](https://supabase.com/docs/guides/auth/auth-github)

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/remix-auth-supabase-github)

## Setup

1. Copy `.env.example` to create a new file `.env`:

```sh
cp .env.example .env
```

2. Go to https://app.supabase.io/project/{PROJECT}/api?page=auth to find your secrets
3. Add your `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` and `PUBLIC_SUPABASE_ANON_KEY` in `.env`

```env
SUPABASE_SERVICE_KEY="{SERVICE_KEY}"
PUBLIC_SUPABASE_ANON_KEY="{ANON_KEY}"
SUPABASE_URL="https://{YOUR_INSTANCE_NAME}.supabase.co"

```

## Using the Remix Auth & SupabaseStrategy 🚀

SupabaseStrategy provides `checkSession` working like Remix Auth `isAuthenticated` but handles token refresh

You must use `checkSession` instead of `isAuthenticated`

## Example

This is using Remix Auth, `remix-auth-supabase` and `supabase-js` packages.

> **⚠️ Never expose your `service_role` key in the browser**

The `/login` route renders a form with a email and password input. After a submit it runs some validations and store `user` object, `access_token` and `refresh_token` in the session.

The `/private` routes redirects the user to `/login` if it's not logged-in, or shows the user email and a logout form if it's logged-in.

**Handle refreshing of tokens** (if expired) or redirects to `/login` if it fails

More use cases can be found on [Supabase Strategy - Use cases](https://github.com/mitchelvanbever/remix-auth-supabase#using-the-authenticator--strategy-)

## Related Links

- [Remix Auth](https://github.com/sergiodxa/remix-auth)
- [Supabase Strategy](https://github.com/mitchelvanbever/remix-auth-supabase)
- [supabase-js](https://github.com/supabase/supabase-js)
