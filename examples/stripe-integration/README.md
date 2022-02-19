# Stripe Integration

A demo of integrate stripe payment with remix so that you can collect payments via stripe

Relevant files:

```
├── app
│   ├── routes
│   │   ├── buy.tsx // buy button and redirect to stripe payment
│   │   └── payment
│   │       ├── cancelled.tsx // stripe will redirect to this page if payment failed
│   │       └── success.tsx // string will redirect to this page if payment sucessful
│   └── utils
│       └── stripe.server.tsx // server side function to init a stripe session
```

## steps to setup

- create a stripe account
  - get the publishable_key and secret key from stripe dashboard
  - create a product, get the price id
- copy the .env.sample to .env, populate the env credentials

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/stripe-integration)

## Caveats

- Seems we need setup a function outside remix to process the stripe payment webhook post back, as Per this [discussion](https://github.com/remix-run/remix/discussions/1978) (Thanks much Sergio!):

> stripe.webhooks.constructEvent probably expects the request body from a Node request, but Remix uses Fetch standard Request objects.

## Related Links

- [How to get the raw request body in action or loader ( for stripe integration) ? · Discussion #1978 · remix-run/remix](https://github.com/remix-run/remix/discussions/1978)
- [Remix | Environment Variables](https://remix.run/docs/en/v1/guides/envvars)
- [Stripe API reference – Node](https://stripe.com/docs/api/authentication?lang=node)
