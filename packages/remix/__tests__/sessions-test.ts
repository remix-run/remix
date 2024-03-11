import { createSession, isSession } from "../sessions";

describe("Session", () => {
  it("has an empty id by default", () => {
    expect(createSession().id).toEqual("");
  });

  it("correctly stores and retrieves values", () => {
    let session = createSession();

    session.set("user", "mjackson");
    session.flash("error", "boom");

    expect(session.has("user")).toBe(true);
    expect(session.get("user")).toBe("mjackson");
    // Normal values should remain in the session after get()
    expect(session.has("user")).toBe(true);
    expect(session.get("user")).toBe("mjackson");

    expect(session.has("error")).toBe(true);
    expect(session.get("error")).toBe("boom");
    // Flash values disappear after the first get()
    expect(session.has("error")).toBe(false);
    expect(session.get("error")).toBeUndefined();

    session.unset("user");

    expect(session.has("user")).toBe(false);
    expect(session.get("user")).toBeUndefined();
  });
});

describe("isSession", () => {
  it("returns `true` for Session objects", () => {
    expect(isSession(createSession())).toBe(true);
  });

  it("returns `false` for non-Session objects", () => {
    expect(isSession({})).toBe(false);
    expect(isSession([])).toBe(false);
    expect(isSession("")).toBe(false);
    expect(isSession(true)).toBe(false);
  });
});
