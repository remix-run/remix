import {
  Links,
  LiveReload,
  LoaderFunction,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  ActionFunction,
  redirect,
  Form
} from "remix";
import { gdprConsent } from "./cookies";

export const loader: LoaderFunction = async ({request}) => {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await gdprConsent.parse(cookieHeader)) || {};
  return { track: cookie.gdprConsent };
}

export const action: ActionFunction = async ({request}) => {
  const formData = await request.formData();
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await gdprConsent.parse(cookieHeader)) || {};

  if (formData.get("accept-gdpr") === "true") {
    cookie.gdprConsent = true;
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await gdprConsent.serialize(cookie)
    }
  });
}

export default function App() {
  const {track} = useLoaderData();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        {!track && <div style={{
      backgroundColor: '#ccc',
      padding: 10,
      position: 'fixed',
      bottom: 0,
     }}>
        <Form method="post" reloadDocument>
         We use Cookies...
         {/* You can pass values on the submission button  */}
         <button name="accept-gdpr" value="true" type="submit">Accept</button>
       </Form>
    </div>}
        <ScrollRestoration />
        { track && <script src="/dummy-analytics-script.js"></script> }
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}
