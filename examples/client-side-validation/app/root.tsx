import type {
  ActionFunction,
  LinksFunction,
  LoaderFunction} from "remix";
import {
  json,
  Links,
  LiveReload,
  Meta,
  Scripts,
  ScrollRestoration,
  useActionData,
  useLoaderData
} from "remix";

import stylesUrl from "./index.css";

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: stylesUrl
    }
  ];
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const message = `Successfully submitted data:
      - Required text: ${form.get("required-text")}
      - Required checkbox: ${form.get("required-checkbox")}
      - Text with regex: ${form.get("text-with-regex")} 
      - Number with min max: ${form.get("number-with-min-max")}
      - Text with minlength maxlength: ${form.get(
        "text-with-minlength-maxlength"
      )}
      - Date with min max: ${form.get("date-with-min-max")}
  `;
  return json({ message }, { status: 200 });
};

type LoaderData = {
  todayString: string;
  tomorrowString: string;
};

export const loader: LoaderFunction = async () => {
  const date = new Date();

  // today string in "YYYY-MM-DD" format
  const todayString = `${date.getFullYear()}-${(
    "00" +
    (date.getMonth() + 1)
  ).slice(-2)}-${("00" + date.getDate()).slice(-2)}`;

  // tomorrow string in "YYYY-MM-DD" format
  const tomorrowString = `${date.getFullYear()}-${(
    "00" +
    (date.getMonth() + 1)
  ).slice(-2)}-${("00" + (date.getDate() + 1)).slice(-2)}`;

  return { todayString, tomorrowString };
};

export default function App() {
  const actionData = useActionData();
  const data = useLoaderData<LoaderData>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="root">
          <h1>Client-Side Validation Example</h1>
          <form method="post">
            <div className="form-control">
              <label>
                Required text
                <abbr title="This field is mandatory" aria-label="required">
                  *
                </abbr>
                <input type="text" name="required-text" required />
              </label>
            </div>
            <div className="form-control">
              <fieldset>
                <legend>
                  Required checkbox
                  <abbr title="This field is mandatory" aria-label="required">
                    *
                  </abbr>
                </legend>
                <label>
                  <input
                    type="radio"
                    required
                    name="required-checkbox"
                    value="yes"
                  />
                  Yes
                </label>
                <label>
                  <input
                    type="radio"
                    required
                    name="required-checkbox"
                    value="maybe"
                  />
                  Maybe
                </label>
                <label>
                  <input
                    type="radio"
                    required
                    name="required-checkbox"
                    value="no"
                  />
                  No
                </label>
              </fieldset>
            </div>
            <div className="form-control">
              <label>
                Text with regex validation (only allow [Bb]anana or [Oo]range)
                <input
                  type="text"
                  name="text-with-regex"
                  list="list1"
                  pattern="[Bb]anana|[Oo]range"
                />
                <datalist id="list1">
                  <option>Banana</option>
                  <option>Cherry</option>
                  <option>Apple</option>
                  <option>Strawberry</option>
                  <option>Lemon</option>
                  <option>Orange</option>
                </datalist>
              </label>
            </div>
            <div className="form-control">
              <label>
                Number with min (12) and max (120) validation
                <input
                  type="number"
                  name="number-with-min-max"
                  min="12"
                  max="120"
                  step="1"
                  pattern="\d+"
                />
              </label>
            </div>
            <div className="form-control">
              <label>
                Email
                <input name="email" type="email" />
              </label>
            </div>
            <div className="form-control">
              <label>Text with minLength(10) and maxLength(140)</label>
              <textarea
                name="text-with-minlength-maxlength"
                minLength={10}
                maxLength={140}
                rows={3}
              ></textarea>
            </div>
            <div className="form-control">
              <label>Date with min(today) and max(tomorrow)</label>
              <input
                type="date"
                name="date-with-min-max"
                min={data.todayString}
                max={data.tomorrowString}
              />
            </div>
            <div className="form-control">
              <button>Submit</button>
            </div>
          </form>
          {actionData?.message && (
            <div className="result">{actionData.message}</div>
          )}
        </div>
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}
