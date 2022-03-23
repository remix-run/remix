import { Form } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";

import { getStripeSession, getDomainUrl } from "~/utils/stripe.server";

export const action: ActionFunction = async ({ request }) => {
  const stripeRedirectUrl = await getStripeSession(
    process.env.PRICE_ID as string,
    getDomainUrl(request)
  );
  return redirect(stripeRedirectUrl);
};

export default function Buy() {
  return (
    <Form method="post">
      <button type="submit">buy</button>
    </Form>
  );
}
