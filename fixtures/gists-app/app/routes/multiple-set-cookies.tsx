import * as React from "react";
import type {
  ActionFunction,
  LoaderFunction,
  MetaFunction,
  RouteComponent
} from "remix";
import { redirect, json, Form } from "remix";
import { Headers } from "@remix-run/node";

let loader: LoaderFunction = async ({ request }) => {
  let headers = new Headers();
  headers.append("Set-Cookie", "foo=bar");
  headers.append("Set-Cookie", "bar=baz");
  return json({}, { headers });
};

let action: ActionFunction = async () => {
  let headers = new Headers();
  headers.append("Set-Cookie", "another=one");
  headers.append("Set-Cookie", "how-about=two");
  return redirect("/multiple-set-cookies", { headers });
};

let meta: MetaFunction = () => ({
  title: "Multi Set Cookie Headers"
});

let MultipleSetCookiesPage: RouteComponent = () => {
  return (
    <>
      <p>👋</p>
      <Form method="post">
        <button type="submit">Add cookies</button>
      </Form>
    </>
  );
};

export default MultipleSetCookiesPage;
export { action, loader, meta };
