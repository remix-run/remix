import { collectedNotes } from "collected-notes";

const email = process.env.CN_EMAIL;
const token = process.env.CN_TOKEN;

if (!email || !token) {
  throw new Error(
    "Missing environment variables CN_EMAIL and CN_TOKEN and CN_SITE"
  );
}

if (!process.env.CN_SITE_PATH) {
  throw new Error("Missing environment variable CN_SITE_PATH");
}

export const cn = collectedNotes(email, token);

export const sitePath = process.env.CN_SITE_PATH!;
