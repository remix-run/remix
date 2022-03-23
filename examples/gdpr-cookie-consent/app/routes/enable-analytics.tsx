import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { gdprConsent } from "~/cookies";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await gdprConsent.parse(cookieHeader)) || {};

  if (formData.get("accept-gdpr") === "true") {
    cookie.gdprConsent = true;
  }

  return json(
    { success: true },
    {
      headers: {
        "Set-Cookie": await gdprConsent.serialize(cookie),
      },
    }
  );
};
