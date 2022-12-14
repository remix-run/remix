import {
  createRoutePath,
  getRouteSegments,
  isIndexRoute,
} from "../config/flat-routes";
import { createRouteId } from "../config/routes";

describe("createRoutePath", () => {
  describe("creates proper route paths", () => {
    let tests: [string, string | undefined][] = [
      ["_auth.forgot-password", "forgot-password"],
      ["_auth.login", "login"],
      ["_auth.reset-password", "reset-password"],
      ["_auth.signup", "signup"],
      ["_auth", undefined],
      ["_landing.about", "about"],
      ["_landing.index", "index"],
      ["_landing", undefined],
      ["app.calendar.$day", "app/calendar/:day"],
      ["app.calendar.index", "app/calendar/index"],
      ["app.projects.$id", "app/projects/:id"],
      ["app.projects", "app/projects"],
      ["app", "app"],
      ["app_.projects.$id.roadmap", "app/projects/:id/roadmap"],
      ["app_.projects.$id.roadmap[.pdf]", "app/projects/:id/roadmap.pdf"],
    ];

    for (let [input, expected] of tests) {
      it(`"${input}" -> "${expected}"`, () => {
        let routeId = createRouteId(input);
        let index = isIndexRoute(routeId);
        let segments = getRouteSegments(input);
        expect(createRoutePath(segments, index)).toBe(expected);
      });
    }
  });
});
