import { isCookie } from "../cookies";

describe("isCookie", () => {
  it("returns `false` for non-Cookie objects", () => {
    expect(isCookie({})).toBe(false);
    expect(isCookie([])).toBe(false);
    expect(isCookie("")).toBe(false);
    expect(isCookie(true)).toBe(false);
  });
});
