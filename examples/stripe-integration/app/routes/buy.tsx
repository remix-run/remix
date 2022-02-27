import { loadStripe } from "@stripe/stripe-js";
import { Form, useActionData, useLoaderData } from "remix";
import type { ActionFunction } from "remix";
import { getStripeSession, getDomainUrl } from "~/utils/stripe.server";

type loaderData = {
  ENV: {
    PRICE_ID: string;
  };
};
type actionData = {
  id: string;
  ENV: {
    STRIPE_PUBLIC_KEY: string;
  };
};
export const loader = async (): Promise<loaderData> => {
  return {
    ENV: {
      PRICE_ID: process.env.PRICE_ID as string
    }
  };
};
export const action: ActionFunction = async ({
  request
}): Promise<actionData> => {
  const formData = await request.formData();
  const id = await getStripeSession(
    formData.get("price_id") as string,
    getDomainUrl(request)
  );
  return {
    id,
    ENV: {
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY as string
    }
  };
};
const checkout = async (sessionId: string, stripePublicKey: string) => {
  const stripe = await loadStripe(stripePublicKey);
  await stripe.redirectToCheckout({ sessionId });
};

const Buy = () => {
  const loaderData = useLoaderData<loaderData>();
  const actionData = useActionData<actionData>();
  if (actionData) {
    checkout(actionData.id, actionData.ENV.STRIPE_PUBLIC_KEY);
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
