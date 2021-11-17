import { Fragment, useEffect } from "react";
import type { LoaderFunction } from "remix";
import { Form, json, useLoaderData, useTransition } from "remix";
import { Link } from "react-router-dom";

import { defaultStyles, sessionStorage } from "./theme-css";

export let handle = {
  breadcrumb: () => <Link to="/resources">Resources</Link>
};

export let loader: LoaderFunction = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));

  let custom = session.get("custom") || {};

  let settings = Object.entries(defaultStyles).reduce<Record<string, string>>(
    (p, [key, defaultValue]) => ({
      ...p,
      [key]: custom[key] || defaultValue
    }),
    {}
  );

  return json(settings);
};

function reloadCss() {
  var links = document.getElementsByTagName("link");
  for (var cl in links) {
    var link = links[cl];
    if (link.rel === "stylesheet") link.href += "";
  }
}

export default function Settings() {
  let settings = useLoaderData<Record<string, string>>();
  let { state, submission } = useTransition();

  useEffect(() => {
    if (state === "loading" && submission) {
      reloadCss();
    }
  }, [state]);

  return (
    <section>
      <h1>Edit theme settings</h1>
      <Form method="post" action="/resources/theme-css">
        <input name="event" type="hidden" value="reset" />
        <button data-testid="reset" type="submit">
          Reset
        </button>
      </Form>
      <Form method="post" action="/resources/theme-css">
        {Object.entries(settings).map(([key, defaultValue]) => (
          <Fragment key={key}>
            <label htmlFor={key}>
              {key}:
              <input name={key} type="color" defaultValue={defaultValue} />
            </label>
            <br />
          </Fragment>
        ))}
        <button data-testid="save" type="submit">
          Save
        </button>
      </Form>
    </section>
  );
}
