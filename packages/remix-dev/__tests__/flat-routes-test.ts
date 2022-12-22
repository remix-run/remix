import { flatRoutesUniversal, pathFromRouteId } from "../config/flat-routes";

describe("flatRoutes", () => {
  describe("pathFromRouteId creates proper route paths", () => {
    let tests: [string, string | undefined][] = [
      ["_auth.forgot-password", "forgot-password"],
      ["_auth.login", "login"],
      ["_auth.reset-password", "reset-password"],
      ["_auth.signup", "signup"],
      ["_auth", undefined],
      ["_landing.about", "about"],
      ["_landing._index", undefined],
      ["_landing.index", "index"],
      ["_landing", undefined],
      ["app.calendar.$day", "app/calendar/:day"],
      ["app.calendar._index", "app/calendar"],
      ["app.projects.$id", "app/projects/:id"],
      ["app.projects", "app/projects"],
      ["app", "app"],
      ["app_.projects.$id.roadmap", "app/projects/:id/roadmap"],
      ["app_/projects/$id/roadmap", "app/projects/:id/roadmap"],
      ["app_.projects/$id.roadmap", "app/projects/:id/roadmap"],
      ["app_.projects.$id.roadmap[.pdf]", "app/projects/:id/roadmap.pdf"],

      ["routes/$", "routes/*"],
      ["routes/sub/$", "routes/sub/*"],
      ["routes.sub/$", "routes/sub/*"],
      ["routes/$slug", "routes/:slug"],
      ["routes/sub/$slug", "routes/sub/:slug"],
      ["routes.sub/$slug", "routes/sub/:slug"],
      ["$", "*"],
      ["nested/$", "nested/*"],
      ["flat.$", "flat/*"],
      ["$slug", ":slug"],
      ["nested/$slug", "nested/:slug"],
      ["flat.$slug", "flat/:slug"],
      ["flat.sub", "flat/sub"],
      ["nested/_index", "nested"],
      ["flat._index", "flat"],
      ["_index", undefined],
      ["_layout/_index", undefined],
      ["_layout/test", "test"],
      ["_layout.test", "test"],
      ["_layout/$slug", ":slug"],
      ["nested/_layout/$slug", "nested/:slug"],
      ["$slug[.]json", ":slug.json"],
      ["sub/[sitemap.xml]", "sub/sitemap.xml"],
      ["posts/$slug/[image.jpg]", "posts/:slug/image.jpg"],
      ["$[$dollabills].[.]lol[/]what/[$].$", ":$dollabills/.lol/what/$/*"],
      ["sub.[[]", "sub/["],
      ["sub.]", "sub/]"],
      ["sub.[[]]", "sub/[]"],
      ["sub.[[]", "sub/["],
      ["beef]", "beef]"],
      ["[_index]", "_index"],
      ["test/inde[x]", "test/index"],
      ["[i]ndex/[[].[[]]", "index/[/[]"],

      // Optional segment routes
      ["(routes)/$", "routes?/*"],
      ["(routes)/(sub)/$", "routes?/sub?/*"],
      ["(routes).(sub)/$", "routes?/sub?/*"],
      ["(routes)/($slug)", "routes?/:slug?"],
      ["(routes)/sub/($slug)", "routes?/sub/:slug?"],
      ["(routes).sub/($slug)", "routes?/sub/:slug?"],
      ["(nested)/$", "nested?/*"],
      ["(flat).$", "flat?/*"],
      ["($slug)", ":slug?"],
      ["(nested)/($slug)", "nested?/:slug?"],
      ["(flat).($slug)", "flat?/:slug?"],
      ["flat.(sub)", "flat/sub?"],
      ["_layout/(test)", "test?"],
      ["_layout.(test)", "test?"],
      ["_layout/($slug)", ":slug?"],
      ["(nested)/_layout/($slug)", "nested?/:slug?"],
      ["($slug[.]json)", ":slug.json?"],
      ["(sub)/([sitemap.xml])", "sub?/sitemap.xml?"],
      ["(sub)/[(sitemap.xml)]", "sub?/(sitemap.xml)"],
      ["(posts)/($slug)/([image.jpg])", "posts?/:slug?/image.jpg?"],
      [
        "($[$dollabills]).([.]lol)[/](what)/([$]).$",
        ":$dollabills?/.lol)/(what?/$?/*",
      ],
      [
        "($[$dollabills]).([.]lol)/(what)/([$]).($up)",
        ":$dollabills?/.lol?/what?/$?/:up?",
      ],
      ["(sub).([[])", "sub?/[?"],
      ["(sub).(])", "sub?/]?"],
      ["(sub).([[]])", "sub?/[]?"],
      ["(sub).([[])", "sub?/[?"],
      ["(beef])", "beef]?"],
      ["([index])", "index?"],
      ["(test)/(inde[x])", "test?/index?"],
      ["([i]ndex)/([[]).([[]])", "index?/[?/[]?"],
    ];

    for (let [input, expected] of tests) {
      it(`"${input}" -> "${expected}"`, () => {
        let result = pathFromRouteId(input, "");
        expect(result).toBe(expected);
      });
    }
  });

  it.only("should return the correct route hierarchy", () => {
    let files = [
      "/test/root/app/routes/$.tsx",
      "/test/root/app/routes/_index.tsx",
      "/test/root/app/routes/about.tsx",
      "/test/root/app/routes/about._index.tsx",
      "/test/root/app/routes/about.faq.tsx",
      "/test/root/app/routes/about.$splat.tsx",
      "/test/root/app/routes/about.$.tsx",

      // escape special characters
      "/test/root/app/routes/about.[$splat].tsx",
      "/test/root/app/routes/about.[[].tsx",
      "/test/root/app/routes/about.[]].tsx",
      "/test/root/app/routes/about.[.].tsx",
      "/test/root/app/routes/about.[*].tsx",
      "/test/root/app/routes/about.[.[.*].].tsx",

      "/test/root/app/routes/_auth.forgot-password.tsx",
      "/test/root/app/routes/_auth.login.tsx",
      "/test/root/app/routes/_auth.reset-password.tsx",
      "/test/root/app/routes/_auth.signup.tsx",
      "/test/root/app/routes/_auth.tsx",
      "/test/root/app/routes/_landing.about.tsx",
      "/test/root/app/routes/_landing._index.tsx",
      "/test/root/app/routes/_landing.index.tsx",
      "/test/root/app/routes/_landing.tsx",
      "/test/root/app/routes/app.calendar.$day.tsx",
      "/test/root/app/routes/app.calendar._index.tsx",
      "/test/root/app/routes/app.projects.$id.tsx",
      "/test/root/app/routes/app.projects.tsx",
      "/test/root/app/routes/app.tsx",
      "/test/root/app/routes/app_.projects.$id.roadmap.tsx",
      "/test/root/app/routes/app_.projects.$id.roadmap[.pdf].tsx",
    ];

    let routeManifest = flatRoutesUniversal("/test/root/app", files, "routes");
    let routes = Object.values(routeManifest);
    expect(routes).toHaveLength(files.length);
    expect(routes).toContainEqual({
      file: "routes/$.tsx",
      id: "routes/$",
      parentId: "root",
      path: "*",
    });
    expect(routes).toContainEqual({
      file: "routes/app.tsx",
      id: "routes/app",
      parentId: "root",
      path: "app",
    });
    expect(routes).toContainEqual({
      file: "routes/_auth.tsx",
      id: "routes/_auth",
      parentId: "root",
      path: undefined,
    });
    expect(routes).toContainEqual({
      file: "routes/about.tsx",
      id: "routes/about",
      parentId: "root",
      path: "about",
    });
    expect(routes).toContainEqual({
      file: "routes/_index.tsx",
      id: "routes/_index",
      index: true,
      parentId: "root",
      path: undefined,
    });
    expect(routes).toContainEqual({
      file: "routes/about.$.tsx",
      id: "routes/about.$",
      parentId: "routes/about",
      path: "*",
    });
    expect(routes).toContainEqual({
      file: "routes/_landing.tsx",
      id: "routes/_landing",
      parentId: "root",
      path: undefined,
    });
    expect(routes).toContainEqual({
      file: "routes/about.[*].tsx",
      id: "routes/about.[*]",
      parentId: "routes/about",
      path: "*",
    });
    expect(routes).toContainEqual({
      file: "routes/about.[.].tsx",
      id: "routes/about.[.]",
      parentId: "routes/about",
      path: ".",
    });
    expect(routes).toContainEqual({
      file: "routes/about.[]].tsx",
      id: "routes/about.[]]",
      parentId: "routes/about",
      path: "]",
    });
    expect(routes).toContainEqual({
      file: "routes/about.[[].tsx",
      id: "routes/about.[[]",
      parentId: "routes/about",
      path: "[",
    });
    expect(routes).toContainEqual({
      file: "routes/about.faq.tsx",
      id: "routes/about.faq",
      parentId: "routes/about",
      path: "faq",
    });
    expect(routes).toContainEqual({
      file: "routes/_auth.login.tsx",
      id: "routes/_auth.login",
      parentId: "routes/_auth",
      path: "login",
    });
    expect(routes).toContainEqual({
      file: "routes/app.projects.tsx",
      id: "routes/app.projects",
      parentId: "routes/app",
      path: "projects",
    });
    expect(routes).toContainEqual({
      file: "routes/_auth.signup.tsx",
      id: "routes/_auth.signup",
      parentId: "routes/_auth",
      path: "signup",
    });
    expect(routes).toContainEqual({
      file: "routes/about.$splat.tsx",
      id: "routes/about.$splat",
      parentId: "routes/about",
      path: ":splat",
    });
    expect(routes).toContainEqual({
      file: "routes/about._index.tsx",
      id: "routes/about._index",
      index: true,
      parentId: "routes/about",
      path: undefined,
    });
    expect(routes).toContainEqual({
      file: "routes/_landing.index.tsx",
      id: "routes/_landing.index",
      parentId: "routes/_landing",
      path: "index",
    });
    expect(routes).toContainEqual({
      file: "routes/_landing.about.tsx",
      id: "routes/_landing.about",
      parentId: "routes/_landing",
      path: "about",
    });
    expect(routes).toContainEqual({
      file: "routes/about.[.[.*].].tsx",
      id: "routes/about.[.[.*].]",
      parentId: "routes/about",
      path: ".[.*].",
    });
    expect(routes).toContainEqual({
      file: "routes/about.[$splat].tsx",
      id: "routes/about.[$splat]",
      parentId: "routes/about",
      path: "$splat",
    });
    expect(routes).toContainEqual({
      file: "routes/_landing._index.tsx",
      id: "routes/_landing._index",
      index: true,
      parentId: "routes/_landing",
      path: undefined,
    });
    expect(routes).toContainEqual({
      file: "routes/app.projects.$id.tsx",
      id: "routes/app.projects.$id",
      parentId: "routes/app.projects",
      path: ":id",
    });
    expect(routes).toContainEqual({
      file: "routes/app.calendar.$day.tsx",
      id: "routes/app.calendar.$day",
      parentId: "routes/app",
      path: "calendar/:day",
    });
    expect(routes).toContainEqual({
      file: "routes/app.calendar._index.tsx",
      id: "routes/app.calendar._index",
      index: true,
      parentId: "routes/app",
      path: "calendar",
    });
    expect(routes).toContainEqual({
      file: "routes/_auth.reset-password.tsx",
      id: "routes/_auth.reset-password",
      parentId: "routes/_auth",
      path: "reset-password",
    });
    expect(routes).toContainEqual({
      file: "routes/_auth.forgot-password.tsx",
      id: "routes/_auth.forgot-password",
      parentId: "routes/_auth",
      path: "forgot-password",
    });
    expect(routes).toContainEqual({
      file: "routes/app_.projects.$id.roadmap.tsx",
      id: "routes/app_.projects.$id.roadmap",
      parentId: "root",
      path: "app/projects/:id/roadmap",
    });
    expect(routes).toContainEqual({
      file: "routes/app_.projects.$id.roadmap[.pdf].tsx",
      id: "routes/app_.projects.$id.roadmap[.pdf]",
      parentId: "root",
      path: "app/projects/:id/roadmap/pdf",
    });
  });
});
