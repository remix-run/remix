import { Outlet } from "react-router-dom";
import { ActionFunction, Form, LoaderFunction, redirect, useLoaderData } from "remix";
import { gdprConsent } from "~/cookies";

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

export const loader: LoaderFunction = async ({request}) => {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await gdprConsent.parse(cookieHeader)) || {};
  return { showGdprBanner: !cookie.gdprConsent };
}

export default function() {
  const {showGdprBanner} = useLoaderData()
  return (
  <div>
    <Outlet/>
    {showGdprBanner && <div style={{
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
  </div>)
}
