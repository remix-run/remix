import * as path from "path";
import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { createAppFixture, createFixture, js } from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/file-upload-handler.jsx": js`
        import {
          json,
          unstable_composeUploadHandlers as composeUploadHandlers,
          unstable_createFileUploadHandler as createFileUploadHandler,
          unstable_createMemoryUploadHandler as createMemoryUploadHandler,
          unstable_parseMultipartFormData as parseMultipartFormData,
          MeterError,
        } from "@remix-run/node";
        import { Form, useActionData } from "@remix-run/react";

        export let action = async ({ request }) => {
          let uploadHandler = composeUploadHandlers(
            createFileUploadHandler({
              directory: "./uploads",
              maxFileSize: 15,
              avoidFileConflicts: false,
              file: ({ filename }) => filename,
            }),
            createMemoryUploadHandler(),
          );

          try {
            let formData = await parseMultipartFormData(request, uploadHandler);

            if (formData.get("test") !== "hidden") {
              return { message: "hidden field not in form data" };
            }

            let file = formData.get("file");
            let size = typeof file !== "string" && file ? file.size : 0;

            return json({ message: "SUCCESS", size });
          } catch (error) {
            if (error instanceof MeterError) {
              return json({ message: "FILE_TOO_LARGE", size: error.maxBytes });
            }
            return json({ message: "ERROR" }, 500);
          }
        };
        
        export default function FileUpload() {
          let { message, size } = useActionData() || {};
          return (
            <main>
              <Form method="post" encType="multipart/form-data">
                <input type="hidden" name="test" value="hidden" />
                <label htmlFor="file">File Uploader</label>
                <br />
                <input type="file" id="file" name="file" />
                <br />
                <button id="submit" type="submit">Submit</button>
                {message && <p id="message">{message}</p>}
                {size && <p id="size">{size}</p>}
              </Form>
            </main>
          );
        }      
      `,

      "app/routes/memory-upload-handler.jsx": js`
        import {
          json,
          unstable_createMemoryUploadHandler as createMemoryUploadHandler,
          unstable_parseMultipartFormData as parseMultipartFormData,
          MeterError,
        } from "@remix-run/node";
        import { Form, useActionData } from "@remix-run/react";

        export let action = async ({ request }) => {
          let uploadHandler = createMemoryUploadHandler({
            maxFileSize: 15,
          });

          try {
            let formData = await parseMultipartFormData(request, uploadHandler);

            if (formData.get("test") !== "hidden") {
              return { message: "hidden field not in form data" };
            }

            let file = formData.get("file");
            let size = typeof file !== "string" && file ? file.size : 0;

            return json({ message: "SUCCESS", size });
          } catch (error) {
            if (error instanceof MeterError) {
              return json({ message: "FILE_TOO_LARGE", size: error.maxBytes });
            }
            return json({ message: "ERROR" }, 500);
          }
        };
        
        export default function MemoryUpload() {
          let { message, size } = useActionData() || {};
          return (
            <main>
              <Form method="post" encType="multipart/form-data">
                <input type="hidden" name="test" value="hidden" />
                <label htmlFor="file">File Uploader</label>
                <br />
                <input type="file" id="file" name="file" />
                <br />
                <button id="submit" type="submit">Submit</button>
                {message && <p id="message">{message}</p>}
                {size && <p id="size">{size}</p>}
              </Form>
            </main>
          );
        }      
      `,
    },
  });

  appFixture = await createAppFixture(fixture);
});

test.afterAll(async () => appFixture.close());

test("can upload a file with createFileUploadHandler", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/file-upload-handler");
  await app.uploadFile("#file", path.resolve(__dirname, "assets/toupload.txt"));
  await app.clickSubmitButton("/file-upload-handler");

  expect(await app.getHtml("#message")).toMatch(">SUCCESS<");
  expect(await app.getHtml("#size")).toMatch(">14<");
});

test("can catch MeterError when file is too big with createFileUploadHandler", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/file-upload-handler");
  await app.uploadFile(
    "#file",
    path.resolve(__dirname, "assets/touploadtoobig.txt")
  );
  await app.clickSubmitButton("/file-upload-handler");

  expect(await app.getHtml("#message")).toMatch(">FILE_TOO_LARGE<");
  expect(await app.getHtml("#size")).toMatch(">15<");
});

test("can upload a file with createMemoryUploadHandler", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/memory-upload-handler");
  await app.uploadFile("#file", path.resolve(__dirname, "assets/toupload.txt"));
  await app.clickSubmitButton("/memory-upload-handler");

  expect(await app.getHtml("#message")).toMatch(">SUCCESS<");
  expect(await app.getHtml("#size")).toMatch(">14<");
});

test("can catch MeterError when file is too big with createMemoryUploadHandler", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/memory-upload-handler");
  await app.uploadFile(
    "#file",
    path.resolve(__dirname, "assets/touploadtoobig.txt")
  );
  await app.clickSubmitButton("/memory-upload-handler");

  expect(await app.getHtml("#message")).toMatch(">FILE_TOO_LARGE<");
  expect(await app.getHtml("#size")).toMatch(">15<");
});

test.describe("without javascript", () => {
  test.use({ javaScriptEnabled: false });

  test("can upload a file with createFileUploadHandler", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/file-upload-handler");
    await app.uploadFile(
      "#file",
      path.resolve(__dirname, "assets/toupload.txt")
    );

    await Promise.all([page.click("#submit"), page.waitForNavigation()]);

    expect(await app.getHtml("#message")).toMatch(">SUCCESS<");
    expect(await app.getHtml("#size")).toMatch(">14<");
  });

  test("can catch MeterError when file is too big with createFileUploadHandler", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/file-upload-handler");
    await app.uploadFile(
      "#file",
      path.resolve(__dirname, "assets/touploadtoobig.txt")
    );

    await Promise.all([page.click("#submit"), page.waitForNavigation()]);

    expect(await app.getHtml("#message")).toMatch(">FILE_TOO_LARGE<");
    expect(await app.getHtml("#size")).toMatch(">15<");
  });

  test("can upload a file with createMemoryUploadHandler", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/memory-upload-handler");
    await app.uploadFile(
      "#file",
      path.resolve(__dirname, "assets/toupload.txt")
    );

    await Promise.all([page.click("#submit"), page.waitForNavigation()]);

    expect(await app.getHtml("#message")).toMatch(">SUCCESS<");
    expect(await app.getHtml("#size")).toMatch(">14<");
  });

  test("can catch MeterError when file is too big with createMemoryUploadHandler", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/memory-upload-handler");
    await app.uploadFile(
      "#file",
      path.resolve(__dirname, "assets/touploadtoobig.txt")
    );

    await Promise.all([page.click("#submit"), page.waitForNavigation()]);

    expect(await app.getHtml("#message")).toMatch(">FILE_TOO_LARGE<");
    expect(await app.getHtml("#size")).toMatch(">15<");
  });
});
