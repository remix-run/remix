import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

describe("CSS modules", () => {
  let fixture: Fixture;
  let app: AppFixture;

  beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "remix.config.js": js`
          module.exports = {
            unstable_cssModules: true
          };
        `,
        "app/button.jsx": js`
          import styles from "~/button.module.css";
          export function Button(props) {
            return <button {...props} className={styles.button}>;
          }
        `,
        "app/button.module.css": js`
          .button {
            color: red;
          }
        `,
        "app/routes/one.jsx": js`
          import { Button } from "~/button";
          export default function() {
            return (
              <div>
                <h1>One</h1>
                <Button>Click Me</Button>
              </div>
            )
          }
        `,
      },
    });

    app = await createAppFixture(fixture);
  });

  afterAll(async () => {
    await app.close();
  });

  it.todo(
    "uses the hashed classname"
    /* async () => {
    //let enableJavaScript = await app.disableJavaScript();
    await app.goto("/one");
    await app.page.waitForNavigation();
    // TODO:
    expect(true).toBe(true);
  } */
  );
});
