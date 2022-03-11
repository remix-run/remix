import initStripe from "stripe";

// copied from (https://github.com/kentcdodds/kentcdodds.com/blob/ebb36d82009685e14da3d4b5d0ce4d577ed09c63/app/utils/misc.tsx#L229-L237)
export function getDomainUrl(request: Request) {
  const host =
    request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");
  if (!host) {
    throw new Error("Could not determine domain URL.");
  }
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export const getStripeSession = async (
  priceId: string,
  domainUrl: string
): Promise<string> => {
  const stripe = initStripe(process.env.STRIPE_SECRET_KEY);
  const lineItems = [
    {
      price: priceId,
      quantity: 1
    }
  ];
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: `${domainUrl}/payment/success`,
    cancel_url: `${domainUrl}/payment/cancelled`
  });
  return session.url;
};
