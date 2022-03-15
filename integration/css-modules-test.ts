import {
  createAppFixture,
  createFixture,
  css,
  js,
  // selectHtml,
} from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

describe("rendering", () => {
  let fixture: Fixture;
  let app: AppFixture;

  beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
            import { Links, Outlet, Scripts } from "remix";
            import stylesHref from "~/styles.css";

            export function links() {
              return [
                { rel: "stylesheet", href: stylesHref },
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

        "app/routes/a.jsx": js`
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

        "app/lib/button.jsx": js`
            import styles from "./button.module.css";
            export function Button(props) {
              return (
                <Button
                  {...props}
                  data-ui-button=""
                  className={styles.button}
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

        "app/lib/text.jsx": js`
            import styles from "./text.module.css";
            export function Text(props) {
              return (
                <span
                  {...props}
                  data-ui-text=""
                  className={styles.text}
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
            export function Heading({ level = 2, ...props }) {
              let Comp = "h" + level;
              return (
                <Comp
                  {...props}
                  data-ui-heading=""
                  data-ui-heading-level={level}
                  className={styles.heading}
                />
              );

          `,

        "app/lib/heading.module.css": css`
          .heading {
            /* TODO: composes: text from "./text.module.css"; */
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

    app = await createAppFixture(fixture);
  });

  afterAll(async () => {
    await app.close();
  });

  //   it.todo("loads the CSS Modules stylesheet", () => {});

  //   it.todo("server renders with hashed classnames", async () => {
  //     let res = await fixture.requestDocument("/");
  //     expect(res.status).toBe(200);
  //     expect(selectHtml(await res.text(), "[data-ui-badge]"))
  //       .toMatchInlineSnapshot(`
  //         "<div data-ui-badge=\\"\\" className=\\"badge__TODO_SOME_HASH bold\\"">
  //           Hello
  //         </div>"
  //       `);
  //   });

  //   it.todo("composes from locally scoped classname", () => {});

  //   it.todo("composes from globally scoped classname", () => {});

  //   it.todo("composes from imported module classname", () => {});

  //   it.todo("composes :global selector with :local selector", () => {});
});
