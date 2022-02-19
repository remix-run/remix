import { loadStripe } from "@stripe/stripe-js";
import { Form, useActionData, useLoaderData } from "remix";
import type { ActionFunction } from "remix";
import { getStripeSession } from "~/utils/stripe.server";

type returnData = {
  id?: string;
  ENV: {
    STRIPE_PUBLIC_KEY?: string;
    PRICE_ID?: string;
  };
};
export const loader = async () => {
  return {
    ENV: {
      PRICE_ID: process.env.PRICE_ID
    }
  };
};
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const id = await getStripeSession(formData.get("price_id") as string);
  return {
    id,
    ENV: {
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY
    }
  };
};
const checkout = async (sessionId: string, stripePublicKey: string) => {
  const stripe = await loadStripe(stripePublicKey);
  await stripe.redirectToCheckout({ sessionId });
};

const Buy = () => {
  const loaderData = useLoaderData<returnData>();
  const data = useActionData<returnData>();
  if (data) {
    checkout(data.id, data.ENV.STRIPE_PUBLIC_KEY);
  }

  return (
    <>
      <Form method="post">
        <button name="price_id" value={loaderData.ENV.PRICE_ID} type="submit">
          buy
        </button>
      </Form>
    </>
  );
};

export default Buy;
