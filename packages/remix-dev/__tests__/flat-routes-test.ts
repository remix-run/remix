import { pathFromRouteId } from "../config/flat-routes";

describe("createRoutePath", () => {
  describe("creates proper route paths", () => {
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
});
