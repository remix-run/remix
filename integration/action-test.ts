import path from "path";

import {
  createFixture,
  createAppFixture,
  selectHtml,
  js,
} from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

describe("actions", () => {
  let fixture: Fixture;
  let app: AppFixture;

  let FIELD_NAME = "message";
  let WAITING_VALUE = "Waiting...";
  let ACTION_DATA_VALUE = "heyooo, data from the action:";
  let SUBMITTED_VALUE = "Submission";
  let THROWS_REDIRECT = "redirect-throw";
  let REDIRECT_TARGET = "page";
  let HAS_FILE_ACTIONS = "file-actions";
  let MAX_FILE_UPLOAD_SIZE = 1234;
  let PAGE_TEXT = "PAGE_TEXT";

  beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/routes/urlencoded.jsx": js`
          import { Form, useActionData } from "@remix-run/react";

          export let action = async ({ request }) => {
            let formData = await request.formData();
            return formData.get("${FIELD_NAME}");
          };

          export default function Actions() {
            let data = useActionData()

            return (
              <Form method="post" id="form">
                <p id="text">
                  {data ? <span id="action-text">{data}</span> : "${WAITING_VALUE}"}
                </p>
                <p>
                  <input type="text" defaultValue="${SUBMITTED_VALUE}" name="${FIELD_NAME}" />
                  <button type="submit" id="submit">Go</button>
                </p>
              </Form>
            );
          }
        `,

        [`app/routes/${THROWS_REDIRECT}.jsx`]: js`
          import { redirect } from "@remix-run/node";
          import { Form } from "@remix-run/react";

          export function action() {
            throw redirect("/${REDIRECT_TARGET}")
          }

          export default function () {
            return (
              <Form method="post">
                <button type="submit">Go</button>
              </Form>
            )
          }
        `,

        [`app/routes/${REDIRECT_TARGET}.jsx`]: js`
          export default function () {
            return <div>${PAGE_TEXT}</div>
          }
        `,

        [`app/routes/${HAS_FILE_ACTIONS}.jsx`]: js`
          import {
            json,
            unstable_parseMultipartFormData as parseMultipartFormData,
            unstable_createFileUploadHandler as createFileUploadHandler,
          } from "@remix-run/node";
          import { Form, useActionData, useLoaderData } from "@remix-run/react";

          const uploadHandler = createFileUploadHandler({
            directory: ".tmp/uploads",
            maxFileSize: ${MAX_FILE_UPLOAD_SIZE},
            // You probably do *not* want to do this in prod.
            // We passthrough the name and allow conflicts for test fixutres.
            avoidFileConflicts: false,
            file: ({ filename }) => filename,
          });

          export async function loader() {
            return "ay! data from the loader!";
          }

          export async function action({ request }) {
            let files = [];
            let formData = await parseMultipartFormData(request, uploadHandler);

            let file = formData.get("file");
            if (file && typeof file !== "string") {
              files.push({ name: file.name, size: file.size });
            }

            return json(
              {
                files,
                message: "${ACTION_DATA_VALUE} " + formData.get("field1"),
              },
              {
                headers: {
                  "x-test": "works",
                },
              }
            );
          };

          export function headers({ actionHeaders }) {
            return {
              "x-test": actionHeaders.get("x-test"),
            };
          };

          export function CatchBoundary() {
            return <h1>Actions Catch Boundary</h1>;
          }

          export function ErrorBoundary({ error }) {
            console.error(error);
            return (
              <div id="actions-error-boundary">
                <h1 id="actions-error-heading">Actions Error Boundary</h1>
                <p id="actions-error-text">{error.message}</p>
              </div>
            );
          }

          export default function Actions() {
            let { files, message } = useActionData() || {};
            let loaderData = useLoaderData();

            return (
              <Form method="post" id="form" encType="multipart/form-data">
                <p id="action-text">
                  {message ? <span id="action-data">{message}</span> : "${WAITING_VALUE}"}
                </p>
                {files ? (
                  <ul>
                    {files.map((file) => (
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
        `,
      },
    });

    app = await createAppFixture(fixture);
  });

  afterAll(async () => {
    await app.close();
  });

  it("is not called on document GET requests", async () => {
    let res = await fixture.requestDocument("/urlencoded");
    let html = selectHtml(await res.text(), "#text");
    expect(html).toMatch(WAITING_VALUE);
  });

  it("is called on document POST requests", async () => {
    let FIELD_VALUE = "cheeseburger";

    let params = new URLSearchParams();
    params.append(FIELD_NAME, FIELD_VALUE);

    let res = await fixture.postDocument("/urlencoded", params);

    let html = selectHtml(await res.text(), "#text");
    expect(html).toMatch(FIELD_VALUE);
  });

  it("is called on script transition POST requests", async () => {
    await app.goto(`/urlencoded`);
    let html = await app.getHtml("#text");
    expect(html).toMatch(WAITING_VALUE);

    await app.page.click("button[type=submit]");
    await app.page.waitForSelector("#action-text");
    html = await app.getHtml("#text");
    expect(html).toMatch(SUBMITTED_VALUE);
  });

  it("redirects a thrown response on document requests", async () => {
    let params = new URLSearchParams();
    let res = await fixture.postDocument(`/${THROWS_REDIRECT}`, params);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/${REDIRECT_TARGET}`);
  });

  it("redirects a thrown response on script transitions", async () => {
    await app.goto(`/${THROWS_REDIRECT}`);
    await app.clickSubmitButton(`/${THROWS_REDIRECT}`);
    // TODO: These are failing but unsure why. Responses array is empty. Problem
    //       w/ Remix or with collectDataResponses?
    // let responses = app.collectDataResponses(); expect(responses.length).toBe(1);
    // expect(responses.length).toBe(1);
    // expect(responses[0].status()).toBe(204);

    expect(new URL(app.page.url()).pathname).toBe(`/${REDIRECT_TARGET}`);
    expect(await app.getHtml()).toMatch(PAGE_TEXT);
  });

  it("can upload file without JavaScript", async () => {
    let _err = console.error;
    console.error = () => {};

    await Promise.all([
      app.goto(`/${HAS_FILE_ACTIONS}`),
      app.disableJavaScript(),
    ]);

    let html = await app.getHtml("#action-text");
    expect(html).toMatch(WAITING_VALUE);

    let fileInput = await app.page.$("#file");
    await fileInput!.uploadFile(path.resolve(__dirname, "assets/toupload.txt"));

    let [response] = await Promise.all([
      app.page.waitForNavigation(),
      app.page.click("#submit"),
    ]);

    expect(response!.status()).toBe(200);
    expect(response!.headers()["x-test"]).toBe("works");

    html = await app.getHtml("#action-text");
    expect(html).toMatch(ACTION_DATA_VALUE + " stuff");

    console.error = _err;
  });

  it("can upload file with JavaScript", async () => {
    await app.goto(`/${HAS_FILE_ACTIONS}`);

    let html = await app.getHtml("#action-text");
    expect(html).toMatch(WAITING_VALUE);

    let fileInput = await app.page.$("#file");
    await fileInput!.uploadFile(path.resolve(__dirname, "assets/toupload.txt"));

    await app.page.click("button[type=submit]");
    await app.page.waitForSelector("#action-data");

    html = await app.getHtml("#action-text");
    expect(html).toMatch(ACTION_DATA_VALUE + " stuff");
  });

  it("rejects too big of an upload without JavaScript", async () => {
    let _err = console.error;
    console.error = () => {};

    await Promise.all([
      app.goto(`/${HAS_FILE_ACTIONS}`),
      app.disableJavaScript(),
    ]);

    let html = await app.getHtml("#action-text");
    expect(html).toMatch(WAITING_VALUE);

    let fileInput = await app.page.$("#file");
    await fileInput!.uploadFile(
      path.resolve(__dirname, "assets/touploadtoobig.txt")
    );

    let [response] = await Promise.all([
      app.page.waitForNavigation(),
      app.page.click("#submit"),
    ]);
    expect(response!.status()).toBe(500);
    let text = await app.getHtml("#actions-error-text");
    expect(text).toMatch(
      `Field "file" exceeded upload size of ${MAX_FILE_UPLOAD_SIZE} bytes`
    );

    console.error = _err;
  });

  it("rejects too big of an upload with JavaScript", async () => {
    await app.goto(`/${HAS_FILE_ACTIONS}`);

    let html = await app.getHtml("#action-text");
    expect(html).toMatch(WAITING_VALUE);

    let fileInput = await app.page.$("#file");
    await fileInput!.uploadFile(
      path.resolve(__dirname, "assets/touploadtoobig.txt")
    );

    await app.page.click("button[type=submit]");
    await app.page.waitForSelector("#actions-error-boundary");

    let text = await app.getHtml("#actions-error-text");
    expect(text).toMatch(
      `Field "file" exceeded upload size of ${MAX_FILE_UPLOAD_SIZE} bytes`
    );
  });
});
