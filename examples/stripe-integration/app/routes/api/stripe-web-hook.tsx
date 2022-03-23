import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import stripe from "stripe";

//[credit @kiliman to get this webhook working](https://github.com/remix-run/remix/discussions/1978)
export const action: ActionFunction = async ({ request }) => {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET
    );
  } catch (err: any) {
    console.log(err);
    throw json({ errors: [{ message: err.message }] }, 400);
  }
  console.log("event", event);
  return new Response(null, { status: 200 });
};
