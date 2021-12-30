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
    let cookie = createCookie("my-cookie");
    let setCookie = await cookie.serialize("");
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`""`);
  });

  it("parses/serializes unsigned string values", async () => {
    let cookie = createCookie("my-cookie");
    let setCookie = await cookie.serialize("hello world");
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toEqual("hello world");
  });

  it("parses/serializes unsigned boolean values", async () => {
    let cookie = createCookie("my-cookie");
    let setCookie = await cookie.serialize(true);
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toBe(true);
  });

  it("parses/serializes signed string values", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    let setCookie = await cookie.serialize("hello michael");
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`"hello michael"`);
  });

  it("fails to parses signed string values with invalid signature", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    let setCookie = await cookie.serialize("hello michael");
    let cookie2 = createCookie("my-cookie", {
      secrets: ["secret2"]
    });
    let value = await cookie2.parse(getCookieFromSetCookie(setCookie));

    expect(value).toBe(null);
  });

  it("parses/serializes signed object values", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    let setCookie = await cookie.serialize({ hello: "mjackson" });
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`
      Object {
        "hello": "mjackson",
      }
    `);
  });

  it("fails to parse signed object values with invalid signature", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    let setCookie = await cookie.serialize({ hello: "mjackson" });
    let cookie2 = createCookie("my-cookie", {
      secrets: ["secret2"]
    });
    let value = await cookie2.parse(getCookieFromSetCookie(setCookie));

    expect(value).toBeNull();
  });

  it("supports secret rotation", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    let setCookie = await cookie.serialize({ hello: "mjackson" });
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

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
    let oldValue = await cookie.parse(getCookieFromSetCookie(setCookie));
    expect(oldValue).toMatchObject(value);

    // New Set-Cookie should be different, it uses a differet secret.
    let setCookie2 = await cookie.serialize(value);
    expect(setCookie).not.toEqual(setCookie2);
  });

  it("parses/serializes unsigned UTF8 string values", async () => {
    let cookie = createCookie("my-cookie");
    let setCookie = await cookie.serialize("سلام دنیا");
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toEqual("سلام دنیا");
  });

  it("parses/serializes signed UTF8 string values", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    let setCookie = await cookie.serialize("سلام ریمیکس");
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`"سلام ریمیکس"`);
  });

  it("parses/serializes signed object UTF8 values", async () => {
    let cookie = createCookie("my-cookie", {
      secrets: ["secret1"]
    });
    let setCookie = await cookie.serialize({ hello: "مایکل" });
    let value = await cookie.parse(getCookieFromSetCookie(setCookie));

    expect(value).toMatchInlineSnapshot(`
      Object {
        "hello": "مایکل",
      }
    `);
  });
});
