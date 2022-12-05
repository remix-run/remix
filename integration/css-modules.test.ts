import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

test.describe("CSS Modules", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
            import { Links, Outlet, Scripts } from "@remix-run/react";
            import cssBundleHref from "@remix-run/css-bundle";
            import stylesHref from "~/styles.css";
            export function links() {
              return [
                { rel: "stylesheet", href: stylesHref },
                { rel: "stylesheet", href: cssBundleHref },
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
            composes: text from "./text.module.css";
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
            import styles from "~/lib/container.module.css";
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
                  className={styles.badge}
                />
              );
            }
          `,

        "app/lib/badge.module.css": css`
          .badge {
            composes: badgeBackgroundColor;
            composes: text from "./text.module.css";
            composes: badgePadding from "~/lib/badge-padding.module.css";
            composes: global_uppercase from global;
            display: inline-block;
            color: black;
            font-size: 0.8rem;
          }
          .badgeBackgroundColor {
            background-color: rgb(200, 200, 200);
          }
          :global(.global_uppercase):local(.badge) {
            text-transform: uppercase;
          }
        `,

        "app/lib/badge-padding.module.css": css`
          .badgePadding {
            padding: 8px 16px;
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
            composes: fontFamily;
            composes: letterSpacing;
          }
          .letterSpacing {
            letter-spacing: -0.5px;
          }
          .fontFamily {
            font-family: system-ui, sans-serif;
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

  test.afterAll(async () => {
    await appFixture.close();
  });

  test("server renders with hashed classnames", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badgeLocator = await page.locator("[data-ui-badge]");
    let badgeStyles = await badgeLocator.evaluate((element) => {
      let { display, backgroundColor } = window.getComputedStyle(element);
      return { display, backgroundColor };
    });
    expect(badgeStyles.display).toBe("inline-block");
  });

  test("composes from a local classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badgeLocator = await page.locator("[data-ui-badge]");
    let badgeStyles = await badgeLocator.evaluate((element) => {
      let { backgroundColor } = window.getComputedStyle(element);
      return { backgroundColor };
    });
    expect(badgeStyles.backgroundColor).toBe("rgb(200, 200, 200)");
  });

  test("composes from an imported classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badgeLocator = await page.locator("[data-ui-badge]");
    let badgeStyles = await badgeLocator.evaluate((element) => {
      let { fontFamily } = window.getComputedStyle(element);
      return { fontFamily };
    });
    expect(badgeStyles.fontFamily).toBe("system-ui, sans-serif");
  });

  test("composes from an imported classname with a root alias (~)", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badgeLocator = await page.locator("[data-ui-badge]");
    let badgeStyles = await badgeLocator.evaluate((element) => {
      let { padding } = window.getComputedStyle(element);
      return { padding };
    });
    expect(badgeStyles.padding).toBe("8px 16px");
  });

  test("composes from a global classname", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badge = await app.getElement("[data-ui-badge]");
    let classList = badge.attr("class")?.split(" ");
    expect(classList).toContain("global_uppercase");
  });

  test("supports combining :global selector with :local selector", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    let badgeLocator = await page.locator("[data-ui-badge]");
    let badgeStyles = await badgeLocator.evaluate((element) => {
      let { textTransform } = window.getComputedStyle(element);
      return { textTransform };
    });
    expect(badgeStyles.textTransform).toBe("uppercase");
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
