# Supabase realtime subscription example

This is an example to implement a simple like button using supabase realtime subscription to keep the number of likes in sync across all clients

The relevent files are:

```
├── app
|   ├── root.tsx // init the supabase on the client side and wrapper the outlet with Supabse provider
|   ├── routes
|   │   └── realtime.tsx  // client subscribe to supabase events and trigger refresh on insert events
|   └── utils
|       └── supabaseClient.server.tsx // create supabase client on the server side
└── .env // holds supabase credentails and url
```

## Steps to set up supabase

## Setup

1. Copy `.env.example` to create a new file `.env`:

```sh
cp .env.example .env
```

2. Go to https://app.supabase.io/project/{PROJECT}/api?page=auth to find your secrets
3. Add your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`

```env
SUPABASE_ANON_KEY="{SUPABASE_ANON_KEY}"
SUPABASE_URL="https://{YOUR_INSTANCE_NAME}.supabase.co"
```

4. create a table "clicks", with a columns of id as primary key ( the table default )

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/supabase-subscription)

## Example

the '/realtime' route renders a "like" button that keep track of number of likes. open the route in two tabs and click on the button, you should see the like number is updated in both tabs.

## Related Links

- [useSubscription – react-supabase](https://react-supabase.vercel.app/documentation/realtime/use-subscription)
- [How to create a real-time UI with NextJS and Supabase](https://pablopunk.com/posts/how-to-create-a-real-time-ui-with-nextjs-and-supabase)
- [Supabase Client | Supabase](https://supabase.com/docs/reference/javascript/supabase-client)
- [Refresh Route Data API · Discussion #1996 · remix-run/remix](https://github.com/remix-run/remix/discussions/1996)
- [Realtime – Vercel Docs](https://vercel.com/docs/concepts/solutions/realtime)
