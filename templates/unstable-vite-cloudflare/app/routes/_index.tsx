import {
  json,
  type MetaFunction,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/cloudflare";
import { Form, useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

const key = "__my-key__";

export async function loader({ context }: LoaderFunctionArgs) {
  const { MY_KV } = context.env;
  const value = await MY_KV.get(key);
  return json({ value });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { MY_KV: myKv } = context.env;

  if (request.method === "POST") {
    const formData = await request.formData();
    const value = formData.get("value") as string;
    await myKv.put(key, value);
    return null;
  }

  if (request.method === "DELETE") {
    await myKv.delete(key);
    return null;
  }

  throw new Error(`Method not supported: "${request.method}"`);
}

export default function Index() {
  const { value } = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Welcome to Remix</h1>
      <a target="_blank" href="https://remix.run/docs" rel="noreferrer">
        Check out the official Remix docs
      </a>
      {value ? (
        <>
          <p>The value set for the key is: {value}</p>
          <Form method="DELETE">
            <button>delete the value</button>
          </Form>
        </>
      ) : (
        <>
          <p>No value for key</p>
          <Form method="POST">
            <label htmlFor="value">Set a new value for the key: </label>
            <input type="text" name="value" id="value" required />
            <br />
            <button>Save</button>
          </Form>
        </>
      )}
    </div>
  );
}
