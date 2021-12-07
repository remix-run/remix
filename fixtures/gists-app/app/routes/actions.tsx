import {
  Form,
  json,
  parseMultipartFormData,
  useActionData,
  useLoaderData
} from "remix";
import type { HeadersFunction, ActionFunction } from "remix";

import { uploadHandler } from "../uploadHandler.server";

export function loader() {
  return "ay! data from the loader!";
}

export let action: ActionFunction = async ({ request }) => {
  let files: any[] = [];

  let formData = await parseMultipartFormData(request, uploadHandler);

  let file = formData.get("file");
  if (file && typeof file !== "string") {
    files.push({ name: file.name, size: file.size });
  }

  return json(
    {
      files,
      message: `heyooo, data from the action: ${formData.get("field1")}`
    },
    {
      headers: {
        "x-test": "works"
      }
    }
  );
};

export let headers: HeadersFunction = ({ actionHeaders }) => {
  return {
    "x-test": actionHeaders.get("x-test")!
  };
};

export function CatchBoundary() {
  return <h1>Actions Catch Boundary</h1>;
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return (
    <div id="actions-error-boundary">
      <h1>Actions Error Boundary</h1>
      <p>{error.message}</p>
    </div>
  );
}

export default function Actions() {
  let { files, message } = useActionData() || {};
  let loaderData = useLoaderData();

  return (
    <Form method="post" id="form" encType="multipart/form-data">
      <p id="action-text">
        {message ? <span id="action-data">{message}</span> : "Waiting..."}
      </p>
      {files ? (
        <ul>
          {files.map((file: any) => (
            <li key={JSON.stringify(file)}>
              <pre>
                <code>{JSON.stringify(file, null, 2)}</code>
              </pre>
            </li>
          ))}
        </ul>
      ) : null}
      <p>
        <label htmlFor="file">Choose a file:</label>

        <input type="file" id="file" name="file" />
      </p>
      <p>
        <input type="text" defaultValue="stuff" name="field1" />
        <button type="submit" id="submit">
          Go
        </button>
      </p>
      <p>{loaderData}</p>
    </Form>
  );
}
