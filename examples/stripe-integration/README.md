# Stripe Integration

A demo of integrate stripe payment with remix, it handles stripe function purely on the server side( getting sessions, redirect etc) and no stripe client needed on the client.

Relevant files:

```
└── app
    ├── routes
    ├── api
    │   └── stripe-web-hook.tsx // api route to get stripe webhook postback
    │   ├── buy.tsx // buy button and redirect to stripe payment
    │   └── payment
    │       ├── cancelled.tsx // stripe will redirect to this page if payment failed
    │       └── success.tsx // string will redirect to this page if payment sucessful
    └── utils
        └── stripe.server.tsx // server side function to init a stripe session
```

## steps to setup

- create a stripe account
  - get the publishable_key and secret key from stripe dashboard
  - create a product, get the price id
  - setup the webhook to get the post back from stripe, get the signing secrets
- copy the .env.sample to .env, populate the env credentials

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/stripe-integration)

## Related Links

- [How to get the raw request body in action or loader ( for stripe integration) ? · Discussion #1978 · remix-run/remix](https://github.com/remix-run/remix/discussions/1978)
- [Remix | Environment Variables](https://remix.run/docs/en/v1/guides/envvars)
- [Stripe API reference – Node](https://stripe.com/docs/api/authentication?lang=node)
- [Take webhooks live | Stripe Documentation](https://stripe.com/docs/webhooks/go-live)
- [Server side redirect to Stripe Checkout - YouTube](https://www.youtube.com/watch?v=WSki6n502mk)
- [code to Domain Url dynamically](https://github.com/kentcdodds/kentcdodds.com/blob/ebb36d82009685e14da3d4b5d0ce4d577ed09c63/app/utils/misc.tsx#L229-L237)
