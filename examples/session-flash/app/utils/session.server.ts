import { createCookieSessionStorage } from "@remix-run/node";

export interface FlashMessage {
  color: string;
  text: string;
}

// Create a minimal cookie sesssion
export const storage = createCookieSessionStorage({
  cookie: {
    name: "session-flash__session",
    secrets: ["mySESSIONsecret"],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

export async function getSession(request: Request) {
  return await storage.getSession(request.headers.get("Cookie"));
}

export async function getSessionFlash(request: Request) {
  const session = await getSession(request);

  const message: FlashMessage = {
    color: session.get("messageColor"),
    text: session.get("messageText"),
  };
  if (!message.color || !message.text) return null;

  const headers = { "Set-Cookie": await storage.commitSession(session) };

  return { message, headers };
}
