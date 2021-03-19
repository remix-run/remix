import type { LinksFunction } from "@remix-run/node";
import { Form, usePendingFormSubmit } from "@remix-run/react";

// @ts-expect-error
import styles from "../styles/gists.new.css";

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

export default function NewGist() {
  let pendingForm = usePendingFormSubmit();

  return (
    <>
      <h2>New Gist!</h2>
      {pendingForm ? (
        <div>
          <p>
            <Loading /> Creating gist: {pendingForm.data.get("fileName")}
          </p>
        </div>
      ) : (
        <Form method="post" action="/gists">
          <p>
            <label>
              Gist file name:
              <br />
              <input required type="text" name="fileName" />
            </label>
          </p>
          <p>
            <label>
              Content:
              <br />
              <textarea required rows={10} name="content" />
            </label>
          </p>
          <p>
            <button type="submit">Create Gist</button>
          </p>
        </Form>
      )}
    </>
  );
}

function Loading() {
  return (
    <svg
      className="spin"
      style={{ height: "1rem" }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
