import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";

describe("NavLink", () => {
  let fixture: Fixture;
  let app: AppFixture;

  beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import {
            NavLink,
            Outlet,
            Scripts
          } from "remix";

          export default function App() {
            return (
              <html>
                <head />
                <body>
                  <header>
                    <nav>
                      <NavLink
                        to="/"
                        end
                        style={isActive => isActive ? {fontWeight: 'bold'} : {}}
                        className={isActive => isActive ? "custom-active" : undefined}
                      >
                        Home
                      </NavLink>
                      
                      <NavLink
                        to="/one"
                        style={isActive => isActive ? {fontWeight: 'bold'} : {}}
                        className={isActive => isActive ? "custom-active" : undefined}
                      >
                        One
                      </NavLink>

                      <NavLink
                        to="/two"
                        style={isActive => isActive ? {fontWeight: 'bold'} : {}}
                        className={isActive => isActive ? "custom-active" : undefined}
                      >
                        Two
                      </NavLink>
                    </nav>
                  </header>
                  <main>
                    <Outlet />
                  </main>
                  <Scripts />
                </body>
              </html>
            );
          }
        `,

        "app/routes/index.jsx": js`
          export default function Index() {
            return <div>Home</div>
          }
        `,
        "app/routes/one.jsx": js`
          export default function One() {
            return <div>One</div>
          }
        `,
        "app/routes/two.jsx": js`
          export default function Two() {
            return <div>Two</div>
          }
        `
      }
    });

    app = await createAppFixture(fixture);
  });

  afterAll(async () => await app.close());

  it("applies custom style and class name only to active", async () => {
    async function fontWeightForNavLinkTo(route: string): Promise<string> {
      return await app.page.$eval(
        `a[href='${route}']`,
        el => (el as HTMLElement).style.fontWeight
      );
    }
    async function classNameForNavLinkTo(route: string): Promise<string> {
      return await app.page.$eval(
        `a[href='${route}']`,
        el => (el as HTMLElement).className
      );
    }

    await app.goto("/");
    expect(await fontWeightForNavLinkTo("/")).toEqual("bold");
    expect(await fontWeightForNavLinkTo("/one")).toEqual("");
    expect(await fontWeightForNavLinkTo("/two")).toEqual("");
    expect(await classNameForNavLinkTo("/")).toEqual("custom-active");
    expect(await classNameForNavLinkTo("/one")).toEqual("");
    expect(await classNameForNavLinkTo("/two")).toEqual("");

    await app.goto("/one");
    expect(await fontWeightForNavLinkTo("/")).toEqual("");
    expect(await fontWeightForNavLinkTo("/one")).toEqual("bold");
    expect(await fontWeightForNavLinkTo("/two")).toEqual("");
    expect(await classNameForNavLinkTo("/")).toEqual("");
    expect(await classNameForNavLinkTo("/one")).toEqual("custom-active");
    expect(await classNameForNavLinkTo("/two")).toEqual("");

    await app.goto("/two");
    expect(await fontWeightForNavLinkTo("/")).toEqual("");
    expect(await fontWeightForNavLinkTo("/one")).toEqual("");
    expect(await fontWeightForNavLinkTo("/two")).toEqual("bold");
    expect(await classNameForNavLinkTo("/")).toEqual("");
    expect(await classNameForNavLinkTo("/one")).toEqual("");
    expect(await classNameForNavLinkTo("/two")).toEqual("custom-active");
  });
});
