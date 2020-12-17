import * as React from "react";
import { useRouteData, Form, usePendingFormSubmit } from "@remix-run/react";
import type { FormProps } from "@remix-run/react";
import { json, parseFormBody, redirect } from "@remix-run/data";

export function loader({ session }) {
  return json({
    body: JSON.parse(session.get("body") || null)
  });
}

export async function action({ request, session }) {
  let body = Object.fromEntries(await parseFormBody(request));

  session.flash("body", JSON.stringify(body));

  if (body.slow === "on") {
    await new Promise(res => setTimeout(res, 2000));
  }

  return redirect("/methods");
}

export default function Methods() {
  let data = useRouteData<{ method: string; body: any }>();
  let [method, setMethod] = React.useState<FormProps["method"]>("post");
  let [enctype, setEnctype] = React.useState<FormProps["encType"]>(
    "application/x-www-form-urlencoded"
  );
  let pendingFormSubmit = usePendingFormSubmit();
  let pendingForm = pendingFormSubmit
    ? // @ts-ignore
      Object.fromEntries(pendingFormSubmit.data)
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
              name="enctype"
              onChange={event =>
                setEnctype(event.target.value as FormProps["enctype"])
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
          <label>
            <input type="checkbox" name="slow" /> Go slow
          </label>
        </p>
        <p>
          <button type="submit" disabled={!!pendingForm}>
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
                <dd>{pendingForm[key]}</dd>
              </div>
            ))}
          </dl>
        ) : data.body ? (
          <dl data-test-id={data.body.selectedMethod}>
            {Object.keys(data.body).map(key => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{data.body[key]}</dd>
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
