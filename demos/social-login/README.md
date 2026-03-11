# Social Login Demo

A small Remix app that demonstrates social login with the new auth stack. It uses `remix/auth` for Google, GitHub, and Facebook login flows, `remix/auth-middleware` to resolve request identity from the session, and standard `fetch-router` middleware for sessions, compression, logging, and static files.

## Running the Demo

```bash
cd demos/social-login
pnpm install
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
pnpm start
```

Then visit http://localhost:44100

Register these callback URLs with your provider apps:

- Google: `http://localhost:44100/auth/google/callback`
- GitHub: `http://localhost:44100/auth/github/callback`
- Facebook: `http://localhost:44100/auth/facebook/callback`

If a provider is not configured, the home page still renders and explains which environment variables are missing.

## Code Highlights

- [`app/router.ts`](app/router.ts) composes the demo out of standard Remix middleware: request logging in development, compression, static file serving, sessions, and global auth loading.
- [`app/middleware/auth.ts`](app/middleware/auth.ts) is the auth bridge. It uses `sessionAuth()` to resolve the current user from the session, creates provider helpers for Google, GitHub, and Facebook, and normalizes provider callback results into one app-specific `SocialUser` shape.
- [`app/auth.tsx`](app/auth.tsx) shows how to use `login()` and `callback()` as request handler factories while still handling missing configuration and callback failures in app code.
- [`app/home.tsx`](app/home.tsx) renders a single page that switches between logged-out and logged-in states by reading `context.get(Auth)` directly in the request handler.
- [`app/router.test.ts`](app/router.test.ts) covers the login buttons, each provider callback flow, and logout session rotation without depending on real OAuth services.
