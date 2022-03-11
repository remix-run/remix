import { Form, redirect, useLoaderData } from "remix";
import type { ActionFunction } from "remix";
import { getStripeSession, getDomainUrl } from "~/utils/stripe.server";

type loaderData = {
  ENV: {
    PRICE_ID: string;
  };
};
export const loader = async (): Promise<loaderData> => {
  return {
    ENV: {
      PRICE_ID: process.env.PRICE_ID as string
    }
  };
};
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const stripeRedirectUrl = await getStripeSession(
    formData.get("price_id") as string,
    getDomainUrl(request)
  );
  return redirect(stripeRedirectUrl);
};
const Buy = () => {
  const loaderData = useLoaderData<loaderData>();
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
