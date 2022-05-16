import { test, expect } from "@playwright/test";
import type * as Playwright from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

// TODO: Finish all todo tests
const testTodo = (
  title: string,
  testFunction?: (
    args: { page: Playwright.Page },
    testInfo: Playwright.TestInfo
  ) => any
) => {};

test.describe("CSS Modules", () => {
  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
            import { Links, Outlet, Scripts } from "@remix-run/react";
            import cssModuleStylesheetUrl from "@remix-run/css-modules";
            import stylesHref from "~/styles.css";
            export function links() {
              return [
                { rel: "stylesheet", href: stylesHref },
                {
                  rel: "stylesheet",
                  href: cssModuleStylesheetUrl,
                  "data-css-modules-link": "",
                },
              ];
            }
            export default function Root() {
              return (
                <html>
                  <head>
                    <Links />
                  </head>
                  <body>
                    <div id="content">
                      <Outlet />
                    </div>
                    <Scripts />
                  </body>
                </html>
              )
            }
          `,
        "app/styles.css": css`
          .reset--button {
            appearance: none;
            display: inline-block;
            border: none;
            padding: 0;
            text-decoration: none;
            background: 0;
            color: inherit;
            font: inherit;
          }
        `,

        "app/routes/index.jsx": js`
            import { Badge } from "~/lib/badge";
            export default function() {
              return (
                <div>
                  <h1>Index</h1>
                  <Badge>Hello</Badge>
                </div>
              );
            }
          `,

        "app/routes/page-a.jsx": js`
            import { Badge } from "~/lib/badge";
            import { Button } from "~/lib/button";
            import { Heading } from "~/lib/heading";
            import { Text } from "~/lib/text";
            export default function() {
              return (
                <div>
                  <Heading level={1}>Route A</Heading>
                  <Badge>Welcome</Badge>
                  <Text>This is really good information, eh?</Text>
                  <Button>Click Me</Button>
                </div>
              );
            }
          `,

        "app/routes/page-b.jsx": js`
            import { Button } from "~/lib/button";
            import { Heading } from "~/lib/heading";
            import { Text } from "~/lib/text";
            export default function() {
              return (
                <div>
                  <Heading level={1}>Route B</Heading>
                  <Text>Here's a red button</Text>
                  <Button variant="red">Click Me</Button>
                </div>
              );
            }
          `,

        "app/routes/layout.jsx": js`
          import { Outlet } from "@remix-run/react";
          import { Container } from "~/lib/container";
          import { Heading } from "~/lib/heading";
          import { Text } from "~/lib/text";
          export default function() {
            return (
              <div>
                <Container>
                  <Heading level={1}>Layout</Heading>
                  <Outlet />
                </Container>
              </div>
            );
          }
        `,

        "app/routes/layout/one.jsx": js`
          import { Heading } from "~/lib/heading";
          import { Input } from "~/lib/input";
          export default function() {
            return (
              <div>
                <Heading level={2}>Subpage 1</Heading>
                <Input name="email" type="email" defaultValue="hi@remix.run" />
              </div>
            );
          }
        `,

        "app/lib/button.jsx": js`
            import styles from "./button.module.css";
            export function Button({ variant, ...props }) {
              return (
                <button
                  {...props}
                  data-ui-button=""
                  className={variant === "red" ? styles.buttonRed : styles.button}
                />
              );
            }
          `,
        "app/lib/button.module.css": css`
          .button {
            /* TODO: composes: text from "./text.module.css"; */
            composes: reset--button from global;
            padding: 0.5rem 1rem;
            box-shadow: none;
            background-color: dodgerblue;
            color: white;
            font-weight: bold;
          }
          .buttonRed {
            composes: button;
            background-color: red;
          }
        `,

        "app/lib/container.jsx": js`
            import styles from "./container.module.css";
            export function Container(props) {
              return (
                <div
                  {...props}
                  data-ui-container=""
                  className={(styles.container + " " + (props.className || "")).trim()}
                />
              );
            }
          `,

        "app/lib/container.module.css": css`
          .container {
            display: block;
            max-width: 1000px;
            margin: 0 auto;
          }
        `,

        "app/lib/badge.jsx": js`
            import styles from "./badge.module.css";
            export function Badge(props) {
              return (
                <div
                  {...props}
                  data-ui-badge=""
                  className={styles.badge + " bold"}
                />
              );
            }
          `,

        "app/lib/badge.module.css": css`
          .badge {
            /* TODO: composes: text from "./text.module.css"; */
            display: inline-block;
            padding: 0.25rem 0.5rem;
            background-color: lightgray;
            color: black;
            font-size: 0.8rem;
          }
          :global(.bold):local(.badge) {
            text-transform: uppercase;
          }
        `,

        "app/lib/input.jsx": js`
            import styles from "./input.module.css";
            export function Input(props) {
              return (
                <input
                  {...props}
                  data-ui-input=""
                  className={(styles.input + " " + (props.className || "")).trim()}
                />
              );
            }
          `,

        "app/lib/input.module.css": css`
          .input {
            width: 100%;
            outline-offset: 2px;
            appearance: none;
            border-radius: 3px;
            border: 1px solid #000;
          }
        `,

        "app/lib/text.jsx": js`
            import styles from "./text.module.css";
            export function Text({ as: Comp = "span", ...props }) {
              return (
                <Comp
                  {...props}
                  data-ui-text=""
                  className={props.className ? props.className + " " +  styles.text : styles.text}
                />
              );
            }
          `,
        "app/lib/text.module.css": css`
          .text {
            font-family: system-ui, sans-serif;
            letter-spacing: -0.5px;
          }
        `,
        "app/lib/heading.jsx": js`
            import styles from "./heading.module.css";
            import { Text } from "~/lib/text";
            export function Heading({ level = 2, ...props }) {
              return (
                <Text
                  {...props}
                  as={"h" + level}
                  data-ui-heading=""
                  data-ui-heading-level={level}
                  className={props.className ? props.className + " " +  styles.heading : styles.heading}
                />
              );
            }
          `,
        "app/lib/heading.module.css": css`
          .heading {
            font-weight: bold;
          }
          .heading[data-heading-level="1"] {
            font-size: 3rem;
          }
          .heading[data-heading-level="2"] {
            font-size: 2rem;
          }
        `,
      },
    });
    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => appFixture.close());

  test("server renders with hashed classnames", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badge = await app.getElement("[data-ui-badge]");
    let badgeClasses = badge.attr("class").split(" ");
    let found: string[] = [];
    for (let className of badgeClasses) {
      if (/^badge-module__[\w-]+_badge$/.test(className)) {
        found.push(className);
      }
    }
    expect(found.length).toBe(1);
  });

  test("composes from global classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/page-a");
    let button = await app.getElement("[data-ui-button]");
    expect(
      button
        .attr("class")
        // .button composes the global .reset--button class
        .includes("reset--button")
    ).toBe(true);
  });

  test("composes from locally scoped classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/page-b");
    let button = await app.getElement("[data-ui-button]");
    let buttonClasses = button.attr("class").split(" ");
    let found: string[] = [];
    for (let className of buttonClasses) {
      if (
        /^button-module__[\w-]+_button$/.test(className) ||
        /^button-module__[\w-]+_buttonRed$/.test(className)
      ) {
        found.push(className);
      }
    }
    expect(found.length).toBe(2);
  });

  // TODO: Feature not implemented yet
  testTodo("composes from imported module classname");

  test("composes :global selector with :local selector", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badge = await app.getElement("[data-ui-badge]");
    let buttonClasses = badge.attr("class").split(" ");
    let found: string[] = [];
    for (let className of buttonClasses) {
      if (
        /^badge-module__[\w-]+_badge$/.test(className) ||
        // .badge composes the global .bold class
        className === "bold"
      ) {
        found.push(className);
      }
    }
    expect(found.length).toBe(2);
  });

  testTodo("keeps declarations in the correct order", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/page-a");
    // let heading = await app.getElement("[data-ui-heading]"); A couple of
    // approaches:
    //  - get the stylesheet text and check the order
    //  - check that the heading itself has computed styles from `Text` that are
    //    not overridden
    //  - check that the heading does NOT have computed styles from `Text` that
    //    are overridden
  });

  test.describe("No javascript", () => {
    test.use({ javaScriptEnabled: false });
    test("loads the CSS Modules stylesheet", async ({ page }) => {
      let app = new PlaywrightFixture(appFixture, page);
      let cssResponses = app.collectResponses((url) =>
        url.pathname.endsWith(".css")
      );
      await app.goto("/");
      expect(cssResponses.length).toEqual(2);
    });
  });
});
