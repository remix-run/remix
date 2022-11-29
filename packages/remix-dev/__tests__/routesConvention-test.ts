import { createRoutePath } from "../config/routesConvention";

describe("createRoutePath", () => {
  describe("creates proper route paths", () => {
    let tests: [string, string | undefined][] = [
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
      ["nested/index", "nested"],
      ["flat.index", "flat"],
      ["index", undefined],
      ["__layout/index", undefined],
      ["__layout/test", "test"],
      ["__layout.test", "test"],
      ["__layout/$slug", ":slug"],
      ["nested/__layout/$slug", "nested/:slug"],
      ["$slug[.]json", ":slug.json"],
      ["sub/[sitemap.xml]", "sub/sitemap.xml"],
      ["posts/$slug/[image.jpg]", "posts/:slug/image.jpg"],
      ["$[$dollabills].[.]lol[/]what/[$].$", ":$dollabills/.lol/what/$/*"],
      ["sub.[[]", "sub/["],
      ["sub.]", "sub/]"],
      ["sub.[[]]", "sub/[]"],
      ["sub.[[]", "sub/["],
      ["beef]", "beef]"],
      ["[index]", "index"],
      ["test/inde[x]", "test/index"],
      ["[i]ndex/[[].[[]]", "index/[/[]"],

      // Optional segment routes
      ["(routes)/$", "routes?/*"],
      ["(routes)/($)", "routes?/*?"], // TODO: Fails, do we want to allow this?
      ["(routes)/(sub)/$", "routes?/sub?/*"],
      ["(routes).(sub)/$", "routes?/sub?/*"],
      ["(routes.sub)/$", "routes?/sub?/*"], // TODO: Fails, do we want to allow this?
      ["(routes)/($slug)", "routes?/:slug?"],
      ["(routes)/sub/($slug)", "routes?/sub/:slug?"],
      ["(routes).sub/($slug)", "routes?/sub/:slug?"],
      ["($)", "*?"], // TODO: Fails, do we want to allow this?
      ["(nested)/$", "nested?/*"],
      ["(flat).$", "flat?/*"],
      ["($slug)", ":slug?"],
      ["(nested)/($slug)", "nested?/:slug?"],
      ["(flat).($slug)", "flat?/:slug?"],
      ["flat.(sub)", "flat/sub?"],
      ["(nested)/(index)", "nested?"], // Fails with `"flat?/index?"`
      ["(flat).(index)", "flat?"], // Fails with `"flat?/index?"`
      ["(index)", undefined], // Fails with `"index?"`"
      ["(__layout)/(index)", undefined], // Fails with __layout?/index?
      ["__layout/(test)", "test?"],
      ["__layout.(test)", "test?"],
      ["__layout/($slug)", ":slug?"],
      ["(nested)/__layout/($slug)", "nested?/:slug?"],
      ["($slug[.]json)", ":slug.json?"],
      ["(sub)/([sitemap.xml])", "sub?/sitemap.xml?"],
      ["(sub)/[(sitemap.xml)]", "sub?/sitemap.xml?"], // TODO should this have been sub?/(sitemap.xml)
      ["(posts)/($slug)/([image.jpg])", "posts?/:slug?/image.jpg?"],
      [
        "($[$dollabills]).([.]lol)[/](what)/([$]).($)", // TODO outputs ":$dollabills?/.lol?/what?/$?/:?"
        ":$dollabills/.lol/what/$/*",
      ],
      ["(sub).([[])", "sub?/[?"],
      ["(sub).(])", "sub?/)?"],
      ["(sub).([([])])", "sub/[]"], // Fails with "sub?/([)]?"
      ["(sub).([[])", "sub?/[?"],
      ["(beef])", "beef]?"],
      ["([index])", "index?"],
      ["(test)/(inde[x])", "test?/index?"],
      ["([i]ndex)/([[]).([[]])", "index?/[?/[]?"],
    ];

    for (let [input, expected] of tests) {
      it(`"${input}" -> "${expected}"`, () => {
        expect(createRoutePath(input)).toBe(expected);
      });
    }
  });
});
