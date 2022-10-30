import path from "path";
import fse from "fs-extra";
import {test, expect} from "@playwright/test";

import {
    createFixture,
    js,
    createDevServerFixture,
} from "./helpers/create-fixture";
import type {Fixture, AppFixture} from "./helpers/create-fixture";
import {PlaywrightFixture} from "./helpers/playwright-fixture";

const INDEX_PATHS = ["app", "routes", "index.jsx"];
const INDEX_ORIGINAL_CONTENT = js`
  export default function Index() {
    return <div id="index">Hello world!</div>
  }
`;
const INDEX_MODIFIED_CONTENT = js`
  export default function Index() {
    return <div id="index">Changed!</div>
  }
`;

test.describe("dev server", () => {
    let fixture: Fixture;
    let appFixture: AppFixture;

    test.beforeAll(async () => {
        fixture = await createFixture({
            setup: "node",
            files: {
                [INDEX_PATHS.join("/")]: INDEX_ORIGINAL_CONTENT,
            },
        });
        appFixture = await createDevServerFixture(fixture);
    });

    test.afterAll(async () => appFixture?.close());

    test("serves ok", async ({page}) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/", true);
        expect(await app.getHtml("#index")).toBe('<div id="index">Hello world!</div>');
    });

    test("live reloads after file changes under app", async ({page}) => {
        let app = new PlaywrightFixture(appFixture, page);
        await app.goto("/", true);
        expect(await app.getHtml("#index")).toBe('<div id="index">Hello world!</div>');

        let filePath = path.join(fixture.projectDir, ...INDEX_PATHS);
        try {
            await fse.writeFile(filePath, INDEX_MODIFIED_CONTENT);

            await page.waitForNavigation();
            expect(await app.getHtml("#index")).toBe('<div id="index">Changed!</div>');
        } finally {
            await fse.writeFile(filePath, INDEX_ORIGINAL_CONTENT);
        }
    });
});
