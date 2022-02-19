import initStripe from "stripe";

export const getStripeSession = async (priceId: string): Promise<string> => {
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
    success_url: "http://localhost:3000/payment/success",
    cancel_url: "http://localhost:3000/payment/cancelled"
  });

  return session.id;
};
