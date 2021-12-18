import { createCookie, isCookie } from "../cookies";

function getCookieFromSetCookie(setCookie: string): string {
  return setCookie.split(/;\s*/)[0];
}

describe("isCookie", () => {
  it("returns `true` for Cookie objects", () => {
    expect(isCookie(createCookie("my-cookie"))).toBe(true);
  });

  it("returns `false` for non-Cookie objects", () => {
    expect(isCookie({})).toBe(false);
    expect(isCookie([])).toBe(false);
    expect(isCookie("")).toBe(false);
    expect(isCookie(true)).toBe(false);
  });
});

describe("cookies", () => {
  it("parses/serializes empty string values", async () => {
    const cookie = createCookie("my-cookie");
    const setCookie = await cookie.serialize("");
    const value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`""`);
  });

  it("parses/serializes unsigned string values", async () => {
    const cookie = createCookie("my-cookie");
    const setCookie = await cookie.serialize("hello world");
    const value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toEqual("hello world");
  });

  it("parses/serializes unsigned boolean values", async () => {
    const cookie = createCookie("my-cookie");
    const setCookie = await cookie.serialize(true);
    const value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toBe(true);
  });

  it("parses/serializes signed string values", async () => {
    const cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    const setCookie = await cookie.serialize("hello michael");
    const value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`"hello michael"`);
  });

  it("fails to parses signed string values with invalid signature", async () => {
    const cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    const setCookie = await cookie.serialize("hello michael");
    const cookie2 = createCookie("my-cookie", {
      secrets: ["secret2"]
    });
    const value = await cookie2.parse(getCookieFromSetCookie(setCookie));

    expect(value).toBe(null);
  });

  it("parses/serializes signed object values", async () => {
    const cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    const setCookie = await cookie.serialize({ hello: "mjackson" });
    const value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`
      Object {
        "hello": "mjackson",
      }
    `);
  });

  it("fails to parse signed object values with invalid signature", async () => {
    const cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    const setCookie = await cookie.serialize({ hello: "mjackson" });
    const cookie2 = createCookie("my-cookie", {
      secrets: ["secret2"]
    });
    const value = await cookie2.parse(getCookieFromSetCookie(setCookie));

    expect(value).toBeNull();
  });

  it("supports secret rotation", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    const setCookie = await cookie.serialize({ hello: "mjackson" });
    const value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`
      Object {
        "hello": "mjackson",
      }
    `);

    // A new secret enters the rotation...
    cookie = createCookie("my-cookie", {
      secrets: ["secret2", "secret1"]
    });

    // cookie should still be able to parse old cookies.
    const oldValue = await cookie.parse(getCookieFromSetCookie(setCookie));
    expect(oldValue).toMatchObject(value);

    // New Set-Cookie should be different, it uses a differet secret.
    const setCookie2 = await cookie.serialize(value);
    expect(setCookie).not.toEqual(setCookie2);
  });
});
