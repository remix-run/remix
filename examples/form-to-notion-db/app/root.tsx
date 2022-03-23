import { Links, LiveReload, Meta, Scripts, ScrollRestoration } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { ActionFunction, MetaFunction } from "@remix-run/node";
import notion from "./notion.server";

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const firstname = form.get("firstname");
  const lastname = form.get("lastname");
  const email = form.get("email");
  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DB_ID },
    properties: {
      Firstname: {
        title: [
          {
            text: {
              content: firstname,
            },
          },
        ],
      },
      Lastname: {
        rich_text: [{ text: { content: lastname } }],
      },
      Email: {
        rich_text: [{ text: { content: email } }],
      },
    },
  } as any);
  return json({ success: true });
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <div>
          <h1>Remix Form to Notion DB Example</h1>
          <form method="post">
            <div>
              <label>
                First name: <input type="text" name="firstname" />
              </label>
            </div>
            <div>
              <label>
                Last name: <input type="text" name="lastname" />
              </label>
            </div>
            <div>
              <label>
                Email: <input type="text" name="email" />
              </label>
            </div>
            <div>
              <button type="submit" className="button">
                Submit
              </button>
            </div>
          </form>
        </div>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
