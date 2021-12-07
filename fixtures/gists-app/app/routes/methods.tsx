import * as React from "react";
import type { LoaderFunction, ActionFunction, FormProps } from "remix";
import { useLoaderData, useTransition, Form, json, redirect } from "remix";

import stylesHref from "../styles/methods.css";
import { getSession, commitSession } from "../sessionStorage";

export function links() {
  return [{ rel: "stylesheet", href: stylesHref }];
}

export let loader: LoaderFunction = async ({ request }) => {
  let session = await getSession(request.headers.get("Cookie"));

  return json({
    body: JSON.parse(session.get("body") || null)
  });
};

export let action: ActionFunction = async ({ request }) => {
  let contentType = request.headers.get("Content-Type");

  let session = await getSession(request.headers.get("Cookie"));
  let bodyParams = await request.formData();
  let body = Array.from(bodyParams.entries()).reduce<
    Record<string, string | string[]>
  >((p, [k, v]) => {
    if (typeof p[k] === "undefined") {
      p[k] = v as string;
    } else if (Array.isArray(p[k])) {
      (p[k] as string[]).push(v as string);
    } else {
      p[k] = [p[k] as string, v as string];
    }
    return p;
  }, {});

  session.flash("body", JSON.stringify(body));

  if (body.slow === "on") {
    await new Promise(res => setTimeout(res, 2000));
  }

  return redirect("/methods", {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
};

export default function Methods() {
  let data = useLoaderData<{ body: any }>();
  let [method, setMethod] = React.useState<FormProps["method"]>("post");
  let [enctype, setEnctype] = React.useState<FormProps["encType"]>(
    "application/x-www-form-urlencoded"
  );
  let pendingFormSubmit = useTransition().submission;
  let pendingForm = pendingFormSubmit
    ? Object.fromEntries(pendingFormSubmit.formData)
    : null;

  return (
    <div data-test-id="/methods">
      <Form action="/methods" method={method} encType={enctype}>
        <p>
          <label>
            Method:{" "}
            <select
              value={method}
              name="selectedMethod"
              onChange={event =>
                setMethod(event.target.value as FormProps["method"])
              }
            >
              <option>get</option>
              <option>post</option>
              <option>put</option>
              <option>delete</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            Enctype:{" "}
            <select
              value={enctype}
              name="selectedEnctype"
              onChange={event =>
                setEnctype(event.target.value as FormProps["encType"])
              }
            >
              <option>application/x-www-form-urlencoded</option>
              <option>multipart/form-data</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            User Input:{" "}
            <input type="text" name="userInput" defaultValue="whatever" />
          </label>
        </p>
        <p>
          Multiple
          <br />
          <label>
            A:{" "}
            <input
              defaultChecked={true}
              type="checkbox"
              name="multiple[]"
              defaultValue="a"
            />
          </label>
          <br />
          <label>
            B:{" "}
            <input
              defaultChecked={true}
              type="checkbox"
              name="multiple[]"
              defaultValue="b"
            />
          </label>
        </p>
        <p>
          <label>
            <input type="checkbox" name="slow" /> Go slow
          </label>
        </p>
        <p>
          <button type="submit" id="submit-with-data" name="data" value="c">
            {method} (with data)
          </button>
          <button type="submit" id="submit">
            {method}
          </button>
        </p>
      </Form>
      <div
        id="results"
        style={{
          opacity: pendingForm ? 0.25 : 1,
          transition: "opacity 300ms",
          transitionDelay: "50ms"
        }}
      >
        {pendingForm ? (
          <dl>
            {Object.keys(pendingForm).map(key => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{pendingForm![key]}</dd>
              </div>
            ))}
          </dl>
        ) : data.body ? (
          <dl data-test-id={data.body.selectedMethod}>
            {Object.keys(data.body).map(key => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{JSON.stringify(data.body[key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>null</p>
        )}
      </div>
    </div>
  );
}
